import { Injectable, Logger } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { DeliveryProvider } from '../../common/enums/delivery-provider.enum';
import { Hub } from '../../hubs/entities/hub.entity';
import { Rider } from '../../riders/entities/rider.entity';
import { ThirdPartyProvider } from '../../third-party-providers/entities/third-party-provider.entity';
import { ParcelTrackingEvent } from '../entities/parcel-tracking-event.entity';
import { Parcel, ParcelStatus } from '../entities/parcel.entity';
import {
  PARCEL_STATUS_EVENT,
  ParcelTrackingActorType,
  ParcelTrackingContext,
  ParcelTrackingEventDraft,
  ParcelTrackingEventType,
} from '../parcel-tracking.types';

/**
 * Customer-visible shipment attributes whose mutation is operationally useful
 * in the parcel timeline. Values are deliberately not copied into metadata;
 * the event only preserves the changed field names so old PII is not retained
 * in the immutable ledger.
 */
const TRACKED_DETAIL_FIELDS = [
  'merchant_order_id',
  'delivery_area',
  'delivery_coverage_area_id',
  'customer_name',
  'customer_phone',
  'customer_secondary_phone',
  'customer_address',
  'product_description',
  'product_price',
  'product_weight',
  'parcel_type',
  'delivery_charge',
  'weight_charge',
  'cod_charge',
  'total_charge',
  'is_cod',
  'cod_amount',
  'is_exchange',
  'delivery_type',
  'special_instructions',
  'admin_notes',
] as const;

@Injectable()
@EventSubscriber()
export class ParcelTrackingSubscriber
  implements EntitySubscriberInterface<Parcel>
{
  private readonly logger = new Logger(ParcelTrackingSubscriber.name);

  constructor(private readonly dataSource: DataSource) {
    if (!dataSource.subscribers.includes(this)) {
      dataSource.subscribers.push(this);
    }
  }

  listenTo() {
    return Parcel;
  }

  async afterInsert(event: InsertEvent<Parcel>): Promise<void> {
    const parcel = event.entity;
    if (!parcel?.id) return;

    try {
      const context = parcel.tracking_context;
      const createdType = parcel.is_return_parcel
        ? ParcelTrackingEventType.RETURN_PARCEL_CREATED
        : ParcelTrackingEventType.PARCEL_CREATED;
      const drafts: ParcelTrackingEventDraft[] = [
        {
          event_type: createdType,
          title: parcel.is_return_parcel
            ? 'Return parcel created'
            : 'Parcel created',
          description: parcel.is_return_parcel
            ? 'A separate parcel was created to track the return journey.'
            : 'The merchant created the parcel order.',
          to_status: parcel.status || ParcelStatus.PENDING,
          actor_type:
            context?.actor_type ||
            (parcel.is_return_parcel
              ? ParcelTrackingActorType.HUB
              : ParcelTrackingActorType.MERCHANT),
          actor_id: context?.actor_id || parcel.merchant_id || null,
          source: context?.source || 'PARCEL_CREATE',
          hub_id: parcel.current_hub_id,
          rider_id: parcel.assigned_rider_id,
          related_parcel_id: parcel.original_parcel_id,
          occurred_at: parcel.created_at || new Date(),
          dedupe_key: `${parcel.id}:created`,
        },
      ];

      if (parcel.pickup_request_id) {
        drafts.push({
          event_type: ParcelTrackingEventType.PICKUP_REQUEST_LINKED,
          title: 'Pickup request linked',
          description: 'The parcel was added to a merchant pickup request.',
          from_status: null,
          to_status: parcel.status || ParcelStatus.PENDING,
          metadata: { pickup_request_id: parcel.pickup_request_id },
          occurred_at: parcel.created_at || new Date(),
          dedupe_key: `${parcel.id}:pickup:${parcel.pickup_request_id}`,
        });
      }

      if (parcel.status && parcel.status !== ParcelStatus.PENDING) {
        const statusDraft = this.statusDraft(null, parcel.status, parcel);
        if (statusDraft && statusDraft.event_type !== createdType) {
          statusDraft.occurred_at = parcel.created_at || new Date();
          statusDraft.dedupe_key = `${parcel.id}:initial:${parcel.status}`;
          drafts.push(statusDraft);
        }
      }

      await this.insertDrafts(event.manager, parcel, drafts, context);
    } catch (error: any) {
      this.logger.error(
        `Failed to record creation tracking for parcel ${parcel.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      delete parcel.tracking_context;
    }
  }

  async afterUpdate(event: UpdateEvent<Parcel>): Promise<void> {
    const current = event.entity as Parcel | undefined;
    const previous = event.databaseEntity as Parcel | undefined;
    const parcelId = current?.id || previous?.id;
    if (!parcelId || !current || !previous) return;

    try {
      await this.ensureLegacyBaseline(event.manager, previous);
      const changed = this.changedFields(event, previous, current);
      if (changed.size === 0) return;

      const context = current.tracking_context;
      const drafts = this.buildUpdateDrafts(
        previous,
        current,
        changed,
        context,
      );
      await this.insertDrafts(event.manager, current, drafts, context);
    } catch (error: any) {
      this.logger.error(
        `Failed to record update tracking for parcel ${parcelId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      delete current.tracking_context;
    }
  }

  private buildUpdateDrafts(
    previous: Parcel,
    current: Parcel,
    changed: Set<string>,
    context?: ParcelTrackingContext,
  ): ParcelTrackingEventDraft[] {
    const drafts: ParcelTrackingEventDraft[] = [];
    const statusChanged = changed.has('status');
    let statusHandled = false;

    if (context?.event_type) {
      drafts.push({
        event_type: context.event_type,
        title: context.title || this.defaultTitle(context.event_type),
        description: context.description || null,
        from_status: previous.status,
        to_status: current.status,
        hub_id: current.current_hub_id || previous.current_hub_id,
        from_hub_id: previous.current_hub_id,
        to_hub_id: current.destination_hub_id || current.current_hub_id,
        rider_id: current.assigned_rider_id || previous.assigned_rider_id,
        related_parcel_id: current.original_parcel_id,
        metadata: context.metadata || null,
      });
      statusHandled = true;
    } else {
      const hubChanged = changed.has('current_hub_id');
      if (
        hubChanged &&
        previous.current_hub_id &&
        !current.current_hub_id &&
        current.destination_hub_id
      ) {
        drafts.push({
          event_type: ParcelTrackingEventType.HUB_TRANSFER_STARTED,
          title: 'Hub transfer started',
          description: 'The parcel departed for another hub.',
          from_status: previous.status,
          to_status: current.status,
          from_hub_id: previous.current_hub_id,
          to_hub_id: current.destination_hub_id,
          location: previous.currentHub?.branch_name || null,
          metadata: current.transfer_notes
            ? { transfer_notes: current.transfer_notes }
            : null,
        });
        statusHandled = current.status === ParcelStatus.IN_TRANSIT;
      } else if (
        hubChanged &&
        current.current_hub_id &&
        (!previous.current_hub_id ||
          previous.current_hub_id !== current.current_hub_id)
      ) {
        const isTransferReceipt =
          previous.destination_hub_id === current.current_hub_id ||
          changed.has('received_at_destination_hub');
        drafts.push({
          event_type: isTransferReceipt
            ? ParcelTrackingEventType.HUB_TRANSFER_RECEIVED
            : previous.current_hub_id
              ? ParcelTrackingEventType.HUB_CHANGED
              : ParcelTrackingEventType.HUB_RECEIVED,
          title: isTransferReceipt
            ? 'Received at destination hub'
            : previous.current_hub_id
              ? 'Parcel moved to another hub'
              : 'Received at hub',
          description: isTransferReceipt
            ? 'The destination hub received and scanned the parcel.'
            : 'The parcel was received for hub processing.',
          from_status: previous.status,
          to_status: current.status,
          hub_id: current.current_hub_id,
          from_hub_id: previous.current_hub_id || previous.origin_hub_id,
          to_hub_id: current.current_hub_id,
        });
        statusHandled = current.status === ParcelStatus.IN_HUB;
      }

      if (changed.has('assigned_rider_id')) {
        if (current.assigned_rider_id && !previous.assigned_rider_id) {
          drafts.push({
            event_type: ParcelTrackingEventType.RIDER_ASSIGNED,
            title: 'Assigned to rider',
            description: 'The parcel was assigned to a delivery rider.',
            from_status: previous.status,
            to_status: current.status,
            hub_id: current.current_hub_id,
            rider_id: current.assigned_rider_id,
          });
          statusHandled = current.status === ParcelStatus.ASSIGNED_TO_RIDER;
        } else if (
          current.assigned_rider_id &&
          previous.assigned_rider_id !== current.assigned_rider_id
        ) {
          drafts.push({
            event_type: ParcelTrackingEventType.RIDER_TRANSFERRED,
            title: 'Transferred to another rider',
            description:
              'The parcel assignment was transferred to another rider.',
            from_status: previous.status,
            to_status: current.status,
            hub_id: current.current_hub_id,
            rider_id: current.assigned_rider_id,
            metadata: { previous_rider_id: previous.assigned_rider_id },
          });
        } else if (!current.assigned_rider_id && previous.assigned_rider_id) {
          drafts.push({
            event_type: ParcelTrackingEventType.RIDER_UNASSIGNED,
            title: 'Rider assignment cleared',
            description:
              'The previous rider assignment was cleared for the next parcel step.',
            from_status: previous.status,
            to_status: current.status,
            hub_id: current.current_hub_id,
            rider_id: previous.assigned_rider_id,
          });
        }
      }

      if (
        (changed.has('third_party_provider_id') ||
          changed.has('delivery_provider')) &&
        current.third_party_provider_id
      ) {
        drafts.push({
          event_type: ParcelTrackingEventType.THIRD_PARTY_ASSIGNED,
          title: 'Assigned to delivery partner',
          description:
            'The parcel was handed to a third-party delivery partner.',
          from_status: previous.status,
          to_status: current.status,
          hub_id: current.current_hub_id,
          metadata: {
            provider_id: current.third_party_provider_id,
            provider: current.delivery_provider,
          },
        });
        statusHandled = current.status === ParcelStatus.ASSIGNED_TO_THIRD_PARTY;
      }

      if (statusChanged && !statusHandled) {
        const statusDraft = this.statusDraft(
          previous.status,
          current.status,
          current,
        );
        if (statusDraft) drafts.push(statusDraft);
      }
    }

    if (
      changed.has('picked_up_at') &&
      current.picked_up_at &&
      !drafts.some(
        (draft) => draft.event_type === ParcelTrackingEventType.PICKED_UP,
      )
    ) {
      drafts.push({
        event_type: ParcelTrackingEventType.PICKED_UP,
        title: 'Parcel picked up',
        description: 'The parcel was collected for processing.',
        from_status: previous.status,
        to_status: current.status,
        hub_id: current.current_hub_id,
        occurred_at: current.picked_up_at,
      });
    }

    if (changed.has('rider_accepted_at') && current.rider_accepted_at) {
      drafts.push({
        event_type: ParcelTrackingEventType.RIDER_ACCEPTED,
        title: 'Parcel accepted by rider',
        description: 'The assigned rider accepted the parcel from the hub.',
        from_status: previous.status,
        to_status: current.status,
        hub_id: current.current_hub_id,
        rider_id: current.assigned_rider_id,
        occurred_at: current.rider_accepted_at,
      });
    }

    if (
      changed.has('out_for_delivery_at') &&
      current.out_for_delivery_at &&
      !drafts.some(
        (draft) =>
          draft.event_type === ParcelTrackingEventType.OUT_FOR_DELIVERY,
      )
    ) {
      drafts.push({
        event_type: ParcelTrackingEventType.OUT_FOR_DELIVERY,
        title: 'Out for delivery',
        description: 'The parcel is on the way to the recipient.',
        from_status: previous.status,
        to_status: current.status,
        hub_id: current.current_hub_id,
        rider_id: current.assigned_rider_id,
        occurred_at: current.out_for_delivery_at,
      });
    }

    if (changed.has('issue_type') && current.issue_type) {
      drafts.push({
        event_type: ParcelTrackingEventType.ISSUE_REPORTED,
        title: 'Delivery issue reported',
        description: 'A delivery issue was reported and sent for review.',
        from_status: previous.status,
        to_status: current.status,
        hub_id: current.current_hub_id,
        rider_id: current.issue_reported_by_id || current.assigned_rider_id,
        occurred_at: current.issue_reported_at || undefined,
        metadata: {
          issue_type: current.issue_type,
          reason: current.issue_description || null,
        },
      });
    }

    if (
      changed.has('issue_type') &&
      previous.issue_type &&
      !current.issue_type
    ) {
      drafts.push({
        event_type: ParcelTrackingEventType.ISSUE_CLEARED,
        title: 'Delivery issue record cleared',
        description: 'The resolved issue record was cleared from the parcel.',
        from_status: previous.status,
        to_status: current.status,
        hub_id: current.current_hub_id,
      });
    } else if (
      changed.has('is_issue_resolved') &&
      current.is_issue_resolved !== previous.is_issue_resolved
    ) {
      drafts.push({
        event_type: current.is_issue_resolved
          ? ParcelTrackingEventType.ISSUE_RESOLVED
          : ParcelTrackingEventType.ISSUE_REOPENED,
        title: current.is_issue_resolved
          ? 'Delivery issue resolved'
          : 'Delivery issue reopened',
        description: current.is_issue_resolved
          ? 'The reported delivery issue was reviewed and resolved.'
          : 'The delivery issue requires review again.',
        from_status: previous.status,
        to_status: current.status,
        hub_id: current.current_hub_id,
      });
    }

    const changedDetails = TRACKED_DETAIL_FIELDS.filter((field) =>
      changed.has(field),
    );
    if (changedDetails.length > 0) {
      drafts.push({
        event_type: ParcelTrackingEventType.PARCEL_DETAILS_UPDATED,
        title: 'Parcel details updated',
        description:
          'Parcel information was updated before the next delivery step.',
        from_status: previous.status,
        to_status: current.status,
        hub_id: current.current_hub_id,
        metadata: { changed_fields: changedDetails },
      });
    }

    if (changed.has('pickup_request_id') && current.pickup_request_id) {
      drafts.push({
        event_type: ParcelTrackingEventType.PICKUP_REQUEST_LINKED,
        title: 'Pickup request linked',
        description: 'The parcel was added to a merchant pickup request.',
        from_status: previous.status,
        to_status: current.status,
        metadata: { pickup_request_id: current.pickup_request_id },
      });
    }

    return drafts;
  }

  private statusDraft(
    fromStatus: ParcelStatus | null,
    toStatus: ParcelStatus,
    parcel: Parcel,
  ): ParcelTrackingEventDraft | null {
    const statusEvent = PARCEL_STATUS_EVENT[toStatus];
    if (!statusEvent) return null;
    const isCarrybee =
      parcel.delivery_provider === DeliveryProvider.CARRYBEE ||
      !!parcel.carrybee_consignment_id;

    return {
      event_type: statusEvent.type,
      title: statusEvent.title,
      description: statusEvent.description,
      from_status: fromStatus,
      to_status: toStatus,
      hub_id: parcel.current_hub_id,
      rider_id: parcel.assigned_rider_id,
      actor_type: isCarrybee ? ParcelTrackingActorType.CARRYBEE : undefined,
      source: isCarrybee ? 'CARRYBEE_WEBHOOK' : undefined,
      related_parcel_id: parcel.original_parcel_id,
      metadata: parcel.return_reason ? { reason: parcel.return_reason } : null,
      occurred_at:
        toStatus === ParcelStatus.DELIVERED ||
        toStatus === ParcelStatus.PARTIAL_DELIVERY ||
        toStatus === ParcelStatus.EXCHANGE ||
        toStatus === ParcelStatus.RETURNED ||
        toStatus === ParcelStatus.PAID_RETURN
          ? parcel.delivered_at || new Date()
          : new Date(),
    };
  }

  private changedFields(
    event: UpdateEvent<Parcel>,
    previous: Parcel,
    current: Parcel,
  ): Set<string> {
    const changed = new Set(
      event.updatedColumns.map((column) => column.propertyName),
    );
    const fields = [
      'status',
      'current_hub_id',
      'origin_hub_id',
      'destination_hub_id',
      'received_at_destination_hub',
      'assigned_rider_id',
      'third_party_provider_id',
      'delivery_provider',
      'picked_up_at',
      'rider_accepted_at',
      'out_for_delivery_at',
      'delivered_at',
      'issue_type',
      'issue_description',
      'issue_reported_at',
      'is_issue_resolved',
      'pickup_request_id',
      ...TRACKED_DETAIL_FIELDS,
    ];
    for (const field of fields) {
      if (
        !this.valuesEqual((previous as any)[field], (current as any)[field])
      ) {
        changed.add(field);
      }
    }
    return changed;
  }

  private valuesEqual(left: unknown, right: unknown): boolean {
    if (left instanceof Date || right instanceof Date) {
      return (
        new Date(left as any).getTime() === new Date(right as any).getTime()
      );
    }
    return left === right;
  }

  private async ensureLegacyBaseline(
    manager: EntityManager,
    parcel: Parcel,
  ): Promise<void> {
    const repository = manager.getRepository(ParcelTrackingEvent);
    const existing = await repository.count({
      where: { parcel_id: parcel.id },
    });
    if (existing > 0) return;

    const drafts: ParcelTrackingEventDraft[] = [
      {
        event_type: parcel.is_return_parcel
          ? ParcelTrackingEventType.RETURN_PARCEL_CREATED
          : ParcelTrackingEventType.PARCEL_CREATED,
        title: parcel.is_return_parcel
          ? 'Return parcel created'
          : 'Parcel created',
        description: parcel.is_return_parcel
          ? 'A separate parcel was created to track the return journey.'
          : 'The merchant created the parcel order.',
        to_status: parcel.is_return_parcel
          ? ParcelStatus.IN_HUB
          : ParcelStatus.PENDING,
        related_parcel_id: parcel.original_parcel_id,
        occurred_at: parcel.created_at || new Date(),
        dedupe_key: `${parcel.id}:created`,
        source: 'LEGACY_BACKFILL',
      },
    ];

    if (parcel.picked_up_at) {
      drafts.push({
        event_type: ParcelTrackingEventType.PICKED_UP,
        title: 'Parcel picked up',
        description: 'The parcel was collected for processing.',
        to_status: ParcelStatus.PICKED_UP,
        occurred_at: parcel.picked_up_at,
        dedupe_key: `${parcel.id}:legacy:picked:${parcel.picked_up_at.getTime()}`,
        source: 'LEGACY_BACKFILL',
      });
    }

    if (parcel.transferred_at) {
      drafts.push({
        event_type: ParcelTrackingEventType.HUB_TRANSFER_STARTED,
        title: 'Hub transfer started',
        description: 'The parcel departed for another hub.',
        to_status: ParcelStatus.IN_TRANSIT,
        from_hub_id: parcel.origin_hub_id,
        to_hub_id: parcel.destination_hub_id || parcel.current_hub_id,
        occurred_at: parcel.transferred_at,
        dedupe_key: `${parcel.id}:legacy:transfer:${parcel.transferred_at.getTime()}`,
        source: 'LEGACY_BACKFILL',
      });
    }

    if (parcel.current_hub_id) {
      const receivedAt =
        parcel.received_at_destination_hub ||
        parcel.picked_up_at ||
        parcel.updated_at;
      if (receivedAt) {
        drafts.push({
          event_type: parcel.received_at_destination_hub
            ? ParcelTrackingEventType.HUB_TRANSFER_RECEIVED
            : ParcelTrackingEventType.HUB_RECEIVED,
          title: parcel.received_at_destination_hub
            ? 'Received at destination hub'
            : 'Received at hub',
          description: 'The parcel was received for hub processing.',
          to_status: ParcelStatus.IN_HUB,
          hub_id: parcel.current_hub_id,
          to_hub_id: parcel.current_hub_id,
          occurred_at: receivedAt,
          dedupe_key: `${parcel.id}:legacy:hub:${new Date(receivedAt).getTime()}`,
          source: 'LEGACY_BACKFILL',
        });
      }
    }

    if (parcel.assigned_at && parcel.assigned_rider_id) {
      drafts.push({
        event_type: ParcelTrackingEventType.RIDER_ASSIGNED,
        title: 'Assigned to rider',
        description: 'The parcel was assigned to a delivery rider.',
        to_status: ParcelStatus.ASSIGNED_TO_RIDER,
        hub_id: parcel.current_hub_id,
        rider_id: parcel.assigned_rider_id,
        occurred_at: parcel.assigned_at,
        dedupe_key: `${parcel.id}:legacy:assigned:${parcel.assigned_at.getTime()}`,
        source: 'LEGACY_BACKFILL',
      });
    }

    if (parcel.rider_accepted_at) {
      drafts.push({
        event_type: ParcelTrackingEventType.RIDER_ACCEPTED,
        title: 'Parcel accepted by rider',
        description: 'The assigned rider accepted the parcel from the hub.',
        rider_id: parcel.assigned_rider_id,
        occurred_at: parcel.rider_accepted_at,
        dedupe_key: `${parcel.id}:legacy:accepted:${parcel.rider_accepted_at.getTime()}`,
        source: 'LEGACY_BACKFILL',
      });
    }

    if (parcel.out_for_delivery_at) {
      drafts.push({
        event_type: ParcelTrackingEventType.OUT_FOR_DELIVERY,
        title: 'Out for delivery',
        description: 'The parcel is on the way to the recipient.',
        to_status: ParcelStatus.OUT_FOR_DELIVERY,
        hub_id: parcel.current_hub_id,
        rider_id: parcel.assigned_rider_id,
        occurred_at: parcel.out_for_delivery_at,
        dedupe_key: `${parcel.id}:legacy:out:${parcel.out_for_delivery_at.getTime()}`,
        source: 'LEGACY_BACKFILL',
      });
    }

    if (
      parcel.status !== ParcelStatus.PENDING &&
      !drafts.some((draft) => draft.to_status === parcel.status)
    ) {
      const previousStatus = this.statusDraft(null, parcel.status, parcel);
      if (previousStatus) {
        previousStatus.occurred_at = parcel.updated_at || new Date();
        previousStatus.dedupe_key = `${parcel.id}:legacy:${parcel.status}:${new Date(previousStatus.occurred_at).getTime()}`;
        previousStatus.source = 'LEGACY_BACKFILL';
        drafts.push(previousStatus);
      }
    }

    await this.insertDrafts(manager, parcel, drafts, undefined);
  }

  private async insertDrafts(
    manager: EntityManager,
    parcel: Parcel,
    drafts: ParcelTrackingEventDraft[],
    context?: ParcelTrackingContext,
  ): Promise<void> {
    if (drafts.length === 0) return;
    const repository = manager.getRepository(ParcelTrackingEvent);

    for (const draft of drafts) {
      await this.enrichNames(manager, draft);
      const actorType =
        context?.actor_type ||
        draft.actor_type ||
        this.inferActorType(parcel, draft.event_type);
      const actorId =
        context?.actor_id ||
        draft.actor_id ||
        (actorType === ParcelTrackingActorType.RIDER
          ? draft.rider_id
          : actorType === ParcelTrackingActorType.HUB
            ? draft.hub_id || draft.from_hub_id || draft.to_hub_id
            : actorType === ParcelTrackingActorType.THIRD_PARTY &&
                typeof draft.metadata?.provider_id === 'string'
              ? draft.metadata.provider_id
              : null);
      const actorName =
        context?.actor_name ||
        draft.actor_name ||
        (actorType === ParcelTrackingActorType.RIDER
          ? draft.rider_name
          : actorType === ParcelTrackingActorType.HUB
            ? draft.hub_name || draft.from_hub_name || draft.to_hub_name
            : null);
      const entity = repository.create({
        parcel_id: parcel.id,
        event_type: draft.event_type,
        title: context?.title || draft.title,
        description:
          context?.description !== undefined
            ? context.description
            : draft.description || null,
        from_status: draft.from_status || null,
        to_status: draft.to_status || null,
        actor_type: actorType,
        actor_id: actorId || null,
        actor_name: actorName || null,
        source: context?.source || draft.source || 'PARCEL_SERVICE',
        hub_id: draft.hub_id || null,
        hub_name: draft.hub_name || null,
        from_hub_id: draft.from_hub_id || null,
        from_hub_name: draft.from_hub_name || null,
        to_hub_id: draft.to_hub_id || null,
        to_hub_name: draft.to_hub_name || null,
        rider_id: draft.rider_id || null,
        rider_name: draft.rider_name || null,
        related_parcel_id: draft.related_parcel_id || null,
        related_tracking_number: draft.related_tracking_number || null,
        location:
          draft.location || draft.hub_name || draft.from_hub_name || null,
        metadata: context?.metadata || draft.metadata || null,
        is_public: context?.is_public ?? draft.is_public ?? true,
        occurred_at: draft.occurred_at || new Date(),
        dedupe_key: draft.dedupe_key || null,
      });
      await repository.save(entity);
    }
  }

  private async enrichNames(
    manager: EntityManager,
    draft: ParcelTrackingEventDraft,
  ): Promise<void> {
    if (draft.hub_id && !draft.hub_name) {
      const hub = await manager.getRepository(Hub).findOne({
        where: { id: draft.hub_id },
        select: { id: true, branch_name: true },
      });
      draft.hub_name = hub?.branch_name || null;
    }
    if (draft.from_hub_id && !draft.from_hub_name) {
      const hub = await manager.getRepository(Hub).findOne({
        where: { id: draft.from_hub_id },
        select: { id: true, branch_name: true },
      });
      draft.from_hub_name = hub?.branch_name || null;
    }
    if (draft.to_hub_id && !draft.to_hub_name) {
      const hub = await manager.getRepository(Hub).findOne({
        where: { id: draft.to_hub_id },
        select: { id: true, branch_name: true },
      });
      draft.to_hub_name = hub?.branch_name || null;
    }
    if (draft.rider_id && !draft.rider_name) {
      const rider = await manager.getRepository(Rider).findOne({
        where: { id: draft.rider_id },
        relations: ['user'],
      });
      draft.rider_name = rider?.user?.full_name || null;
    }
    const providerId = draft.metadata?.provider_id;
    if (providerId && typeof providerId === 'string' && !draft.actor_name) {
      const provider = await manager.getRepository(ThirdPartyProvider).findOne({
        where: { id: providerId },
        select: { id: true, provider_name: true },
      });
      draft.actor_name = provider?.provider_name || null;
    }

    if (draft.event_type === ParcelTrackingEventType.HUB_TRANSFER_STARTED) {
      draft.description = `The parcel departed${draft.from_hub_name ? ` from ${draft.from_hub_name}` : ''}${draft.to_hub_name ? ` for ${draft.to_hub_name}` : ' for another hub'}.`;
    } else if (
      draft.event_type === ParcelTrackingEventType.HUB_TRANSFER_RECEIVED
    ) {
      draft.description = `The parcel was received${draft.to_hub_name ? ` at ${draft.to_hub_name}` : ' at the destination hub'}.`;
    } else if (
      (draft.event_type === ParcelTrackingEventType.RIDER_ASSIGNED ||
        draft.event_type === ParcelTrackingEventType.RIDER_TRANSFERRED) &&
      draft.rider_name
    ) {
      draft.description = `The parcel was assigned to ${draft.rider_name}.`;
    } else if (
      draft.event_type === ParcelTrackingEventType.HUB_RECEIVED &&
      draft.hub_name
    ) {
      draft.description = `The parcel was received and is being processed at ${draft.hub_name}.`;
    }
  }

  private inferActorType(
    parcel: Parcel,
    type: ParcelTrackingEventType,
  ): ParcelTrackingActorType {
    if (
      parcel.delivery_provider === DeliveryProvider.CARRYBEE ||
      parcel.carrybee_consignment_id
    ) {
      return ParcelTrackingActorType.CARRYBEE;
    }
    if (
      type === ParcelTrackingEventType.RIDER_ACCEPTED ||
      type === ParcelTrackingEventType.OUT_FOR_DELIVERY ||
      type === ParcelTrackingEventType.DELIVERY_COMPLETED ||
      type === ParcelTrackingEventType.PARTIAL_DELIVERY ||
      type === ParcelTrackingEventType.EXCHANGE_COMPLETED ||
      type === ParcelTrackingEventType.DELIVERY_FAILED ||
      type === ParcelTrackingEventType.RETURN_INITIATED ||
      type === ParcelTrackingEventType.PAID_RETURN_INITIATED ||
      type === ParcelTrackingEventType.ISSUE_REPORTED
    ) {
      return ParcelTrackingActorType.RIDER;
    }
    if (type === ParcelTrackingEventType.THIRD_PARTY_ASSIGNED) {
      return ParcelTrackingActorType.THIRD_PARTY;
    }
    if (
      type === ParcelTrackingEventType.PARCEL_CREATED ||
      type === ParcelTrackingEventType.PARCEL_DETAILS_UPDATED
    ) {
      return ParcelTrackingActorType.MERCHANT;
    }
    return ParcelTrackingActorType.HUB;
  }

  private defaultTitle(type: ParcelTrackingEventType): string {
    return type
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
