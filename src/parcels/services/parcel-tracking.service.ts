import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Parcel, ParcelStatus } from '../entities/parcel.entity';
import { ParcelTrackingEvent } from '../entities/parcel-tracking-event.entity';
import {
  PARCEL_STATUS_EVENT,
  ParcelTrackingActorType,
  ParcelTrackingEventDraft,
  ParcelTrackingEventType,
} from '../parcel-tracking.types';

@Injectable()
export class ParcelTrackingService {
  constructor(
    @InjectRepository(ParcelTrackingEvent)
    private readonly eventRepository: Repository<ParcelTrackingEvent>,
    @InjectRepository(Parcel)
    private readonly parcelRepository: Repository<Parcel>,
  ) {}

  /**
   * Adds immutable lifecycle events and linked forward/return parcel summaries
   * to an already-authorized parcel. Existing parcel fields are left untouched.
   */
  async enrichParcel(parcel: Parcel): Promise<Parcel> {
    const persistedEvents = await this.eventRepository.find({
      where: { parcel_id: parcel.id, is_public: true },
      order: { occurred_at: 'ASC', created_at: 'ASC' },
    });

    const events = this.withLegacyFallback(parcel, persistedEvents);
    parcel.tracking_events = events;

    if (parcel.original_parcel_id && !parcel.originalParcel) {
      parcel.originalParcel = await this.findLinkedParcel(
        parcel.original_parcel_id,
      );
    }

    parcel.returnParcels = await this.findReturnDescendants(parcel.id);

    return parcel;
  }

  async record(
    parcelId: string,
    draft: ParcelTrackingEventDraft,
    manager?: EntityManager,
  ): Promise<ParcelTrackingEvent> {
    const repository = manager
      ? manager.getRepository(ParcelTrackingEvent)
      : this.eventRepository;
    const event = repository.create({
      parcel_id: parcelId,
      description: null,
      from_status: null,
      to_status: null,
      actor_type: ParcelTrackingActorType.SYSTEM,
      actor_id: null,
      actor_name: null,
      source: 'SYSTEM',
      hub_id: null,
      hub_name: null,
      from_hub_id: null,
      from_hub_name: null,
      to_hub_id: null,
      to_hub_name: null,
      rider_id: null,
      rider_name: null,
      related_parcel_id: null,
      related_tracking_number: null,
      location: null,
      metadata: null,
      is_public: true,
      occurred_at: new Date(),
      dedupe_key: null,
      ...draft,
    });
    return repository.save(event);
  }

  /** Persist the recoverable pre-ledger history before a partial SQL update. */
  async ensurePersistedBaseline(
    parcel: Parcel,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = manager
      ? manager.getRepository(ParcelTrackingEvent)
      : this.eventRepository;
    const existing = await repository.count({
      where: { parcel_id: parcel.id },
    });
    if (existing > 0) return;

    for (const legacy of this.buildLegacyEvents(parcel)) {
      const event = repository.create({
        parcel_id: parcel.id,
        event_type: legacy.event_type,
        title: legacy.title,
        description: legacy.description,
        from_status: legacy.from_status,
        to_status: legacy.to_status,
        actor_type: legacy.actor_type,
        actor_id: legacy.actor_id,
        actor_name: legacy.actor_name,
        source: 'LEGACY_BACKFILL',
        hub_id: legacy.hub_id,
        hub_name: legacy.hub_name,
        from_hub_id: legacy.from_hub_id,
        from_hub_name: legacy.from_hub_name,
        to_hub_id: legacy.to_hub_id,
        to_hub_name: legacy.to_hub_name,
        rider_id: legacy.rider_id,
        rider_name: legacy.rider_name,
        related_parcel_id: legacy.related_parcel_id,
        related_tracking_number: legacy.related_tracking_number,
        location: legacy.location,
        metadata: legacy.metadata,
        is_public: legacy.is_public,
        occurred_at: legacy.occurred_at,
        dedupe_key: `${parcel.id}:legacy:${legacy.event_type}:${new Date(legacy.occurred_at).getTime()}`,
      });
      await repository.save(event);
    }
  }

  private readonly linkedParcelSelect = {
    id: true,
    tracking_number: true,
    parcel_tx_id: true,
    status: true,
    is_return_parcel: true,
    original_parcel_id: true,
    created_at: true,
    updated_at: true,
  } as const;

  private async findLinkedParcel(id: string): Promise<Parcel | null> {
    return this.parcelRepository.findOne({
      where: { id },
      select: this.linkedParcelSelect,
    });
  }

  private async findReturnDescendants(parcelId: string): Promise<Parcel[]> {
    const descendants: Parcel[] = [];
    const visited = new Set<string>([parcelId]);
    let parentIds = [parcelId];

    // A hard guard protects tracking reads if bad legacy data contains a cycle.
    for (let depth = 0; depth < 25 && parentIds.length > 0; depth++) {
      const children = await this.parcelRepository.find({
        where: { original_parcel_id: In(parentIds) },
        select: this.linkedParcelSelect,
        order: { created_at: 'ASC' },
      });
      const unseen = children.filter((child) => !visited.has(child.id));
      if (unseen.length === 0) break;

      for (const child of unseen) visited.add(child.id);
      descendants.push(...unseen);
      parentIds = unseen.map((child) => child.id);
    }

    return descendants.sort(
      (left, right) =>
        new Date(left.created_at).getTime() -
        new Date(right.created_at).getTime(),
    );
  }

  private withLegacyFallback(
    parcel: Parcel,
    persisted: ParcelTrackingEvent[],
  ): ParcelTrackingEvent[] {
    if (persisted.length === 0) {
      return this.buildLegacyEvents(parcel);
    }

    if (
      parcel.created_at &&
      !persisted.some(
        (event) =>
          event.event_type === ParcelTrackingEventType.PARCEL_CREATED ||
          event.event_type === ParcelTrackingEventType.RETURN_PARCEL_CREATED,
      )
    ) {
      return [this.legacyCreatedEvent(parcel), ...persisted];
    }

    return persisted;
  }

  private buildLegacyEvents(parcel: Parcel): ParcelTrackingEvent[] {
    const events: ParcelTrackingEvent[] = [];
    if (parcel.created_at) {
      events.push(this.legacyCreatedEvent(parcel));
    }

    if (parcel.picked_up_at) {
      events.push(
        this.legacyEvent(parcel, {
          event_type: ParcelTrackingEventType.PICKED_UP,
          title: 'Parcel picked up',
          description: 'The parcel was collected for processing.',
          to_status: ParcelStatus.PICKED_UP,
          occurred_at: parcel.picked_up_at,
        }),
      );
    }

    if (parcel.transferred_at && parcel.destination_hub_id) {
      events.push(
        this.legacyEvent(parcel, {
          event_type: ParcelTrackingEventType.HUB_TRANSFER_STARTED,
          title: 'Hub transfer started',
          description: 'The parcel departed for another hub.',
          to_status: ParcelStatus.IN_TRANSIT,
          from_hub_id: parcel.origin_hub_id,
          from_hub_name: parcel.originHub?.branch_name || null,
          to_hub_id: parcel.destination_hub_id,
          to_hub_name: parcel.destinationHub?.branch_name || null,
          location: parcel.originHub?.branch_name || null,
          occurred_at: parcel.transferred_at,
        }),
      );
    }

    const hubReceivedAt =
      parcel.received_at_destination_hub ||
      ((parcel.status === ParcelStatus.IN_HUB || parcel.current_hub_id) &&
      !parcel.transferred_at
        ? parcel.picked_up_at || parcel.updated_at
        : null);
    if (hubReceivedAt && parcel.current_hub_id) {
      events.push(
        this.legacyEvent(parcel, {
          event_type: parcel.received_at_destination_hub
            ? ParcelTrackingEventType.HUB_TRANSFER_RECEIVED
            : ParcelTrackingEventType.HUB_RECEIVED,
          title: parcel.received_at_destination_hub
            ? 'Received at destination hub'
            : 'Received at hub',
          description: `The parcel was received${parcel.currentHub?.branch_name ? ` at ${parcel.currentHub.branch_name}` : ' at a hub'}.`,
          to_status: ParcelStatus.IN_HUB,
          hub_id: parcel.current_hub_id,
          hub_name: parcel.currentHub?.branch_name || null,
          location: parcel.currentHub?.branch_name || null,
          occurred_at: hubReceivedAt,
        }),
      );
    }

    if (parcel.assigned_at && parcel.assigned_rider_id) {
      const riderName =
        parcel.assignedRider?.user?.full_name ||
        (parcel.assignedRider as any)?.full_name ||
        null;
      events.push(
        this.legacyEvent(parcel, {
          event_type: ParcelTrackingEventType.RIDER_ASSIGNED,
          title: 'Assigned to rider',
          description: riderName
            ? `The parcel was assigned to ${riderName}.`
            : 'The parcel was assigned to a delivery rider.',
          to_status: ParcelStatus.ASSIGNED_TO_RIDER,
          rider_id: parcel.assigned_rider_id,
          rider_name: riderName,
          occurred_at: parcel.assigned_at,
        }),
      );
    }

    if (parcel.rider_accepted_at) {
      events.push(
        this.legacyEvent(parcel, {
          event_type: ParcelTrackingEventType.RIDER_ACCEPTED,
          title: 'Parcel accepted by rider',
          description: 'The assigned rider accepted the parcel from the hub.',
          rider_id: parcel.assigned_rider_id,
          rider_name: parcel.assignedRider?.user?.full_name || null,
          occurred_at: parcel.rider_accepted_at,
        }),
      );
    }

    if (parcel.out_for_delivery_at) {
      events.push(
        this.legacyEvent(parcel, {
          event_type: ParcelTrackingEventType.OUT_FOR_DELIVERY,
          title: 'Out for delivery',
          description: 'The parcel is on the way to the recipient.',
          to_status: ParcelStatus.OUT_FOR_DELIVERY,
          rider_id: parcel.assigned_rider_id,
          rider_name: parcel.assignedRider?.user?.full_name || null,
          occurred_at: parcel.out_for_delivery_at,
        }),
      );
    }

    const terminalOrCurrent = PARCEL_STATUS_EVENT[parcel.status];
    const alreadyRepresented = events.some(
      (event) => event.to_status === parcel.status,
    );
    if (terminalOrCurrent && !alreadyRepresented) {
      events.push(
        this.legacyEvent(parcel, {
          event_type: terminalOrCurrent.type,
          title: terminalOrCurrent.title,
          description: terminalOrCurrent.description,
          to_status: parcel.status,
          occurred_at: parcel.delivered_at || parcel.updated_at,
          metadata: parcel.return_reason
            ? { reason: parcel.return_reason }
            : null,
        }),
      );
    }

    return events.sort(
      (a, b) =>
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
    );
  }

  private legacyCreatedEvent(parcel: Parcel): ParcelTrackingEvent {
    return this.legacyEvent(parcel, {
      event_type: parcel.is_return_parcel
        ? ParcelTrackingEventType.RETURN_PARCEL_CREATED
        : ParcelTrackingEventType.PARCEL_CREATED,
      title: parcel.is_return_parcel
        ? 'Return parcel created'
        : 'Parcel created',
      description: parcel.is_return_parcel
        ? 'A separate parcel was created to track the return journey.'
        : 'The merchant created the parcel order.',
      // For legacy rows the current status is not the creation status. New
      // inserts are captured by the subscriber with their exact initial state.
      to_status: parcel.is_return_parcel
        ? ParcelStatus.IN_HUB
        : ParcelStatus.PENDING,
      related_parcel_id: parcel.original_parcel_id,
      occurred_at: parcel.created_at,
    });
  }

  private legacyEvent(
    parcel: Parcel,
    draft: ParcelTrackingEventDraft,
  ): ParcelTrackingEvent {
    const occurredAt = draft.occurred_at || parcel.created_at || new Date();
    return {
      id: `legacy-${parcel.id}-${draft.event_type}-${occurredAt.getTime()}`,
      parcel_id: parcel.id,
      parcel,
      event_type: draft.event_type,
      title: draft.title,
      description: draft.description || null,
      from_status: draft.from_status || null,
      to_status: draft.to_status || null,
      actor_type: draft.actor_type || ParcelTrackingActorType.SYSTEM,
      actor_id: draft.actor_id || null,
      actor_name: draft.actor_name || null,
      source: draft.source || 'LEGACY_BACKFILL',
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
      location: draft.location || null,
      metadata: draft.metadata || null,
      is_public: draft.is_public ?? true,
      occurred_at: occurredAt,
      dedupe_key: draft.dedupe_key || null,
      created_at: occurredAt,
    };
  }
}
