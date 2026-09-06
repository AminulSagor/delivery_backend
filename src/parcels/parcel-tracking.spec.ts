import { toParcelDetail } from '../common/interfaces/responses.interface';
import { ParcelTrackingEvent } from './entities/parcel-tracking-event.entity';
import { Parcel, ParcelStatus } from './entities/parcel.entity';
import {
  PARCEL_STATUS_EVENT,
  ParcelTrackingActorType,
  ParcelTrackingEventType,
} from './parcel-tracking.types';
import { ParcelTrackingService } from './services/parcel-tracking.service';
import { ParcelTrackingSubscriber } from './subscribers/parcel-tracking.subscriber';
import { Hub } from '../hubs/entities/hub.entity';
import { HubManager } from '../hubs/entities/hub-manager.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Rider } from '../riders/entities/rider.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { PickupRequestsService } from '../pickup-requests/pickup-requests.service';
import { ParcelsService } from './parcels.service';

const date = (value: string) => new Date(value);

describe('parcel lifecycle tracking', () => {
  it('fans out in-app notifications across admin, merchant, hub, and rider panels', async () => {
    const inserted: any[][] = [];
    const notificationBuilder: any = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn((values) => {
        inserted.push(values);
        return notificationBuilder;
      }),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    const manager: any = {
      getRepository: jest.fn((entity) => {
        if (entity === Merchant) {
          return {
            findOne: jest.fn().mockResolvedValue({ user_id: 'merchant-user' }),
          };
        }
        if (entity === Rider) {
          return {
            findOne: jest.fn().mockResolvedValue({ user_id: 'rider-user' }),
          };
        }
        if (entity === HubManager) {
          return {
            find: jest.fn().mockResolvedValue([
              {
                user_id: 'hub-user',
                hub_id: 'hub-1',
              },
            ]),
          };
        }
        if (entity === User) {
          return {
            find: jest
              .fn()
              .mockResolvedValue([{ id: 'admin-user', role: UserRole.ADMIN }]),
          };
        }
        if (entity === Notification) {
          return { createQueryBuilder: jest.fn(() => notificationBuilder) };
        }
        return { findOne: jest.fn().mockResolvedValue(null) };
      }),
    };
    const subscriber = Object.create(
      ParcelTrackingSubscriber.prototype,
    ) as ParcelTrackingSubscriber;
    const parcel: any = {
      id: '9709e313-9cf0-4d02-a217-c040283e86bf',
      merchant_id: 'merchant-1',
      tracking_number: 'TRK-1',
      parcel_tx_id: '#1',
      current_hub_id: 'hub-1',
      assigned_rider_id: 'rider-1',
    };

    await (subscriber as any).createInAppNotifications(
      manager,
      parcel,
      {
        id: 'event-issue',
        event_type: ParcelTrackingEventType.ISSUE_REPORTED,
        title: 'Issue reported',
        description: 'COD mismatch',
        hub_id: 'hub-1',
        source: 'PARCEL_SERVICE',
      },
      ParcelTrackingActorType.RIDER,
      'rider-1',
    );
    await (subscriber as any).createInAppNotifications(
      manager,
      parcel,
      {
        id: 'event-assigned',
        event_type: ParcelTrackingEventType.RIDER_ASSIGNED,
        title: 'Assigned to rider',
        description: 'Ready for delivery',
        hub_id: 'hub-1',
        rider_id: 'rider-1',
        source: 'PARCEL_SERVICE',
      },
      ParcelTrackingActorType.HUB,
      'hub-1',
    );

    const roles = inserted
      .flat()
      .map((value) => value.recipient_role)
      .sort();
    expect(new Set(roles)).toEqual(
      new Set([
        UserRole.ADMIN,
        UserRole.MERCHANT,
        UserRole.HUB_MANAGER,
        UserRole.RIDER,
      ]),
    );
  });

  it('has a public lifecycle event mapping for every parcel status', () => {
    expect(Object.keys(PARCEL_STATUS_EVENT).sort()).toEqual(
      Object.values(ParcelStatus).sort(),
    );
  });

  it('keeps repeated hub legs and recognizes a return journey while in transit', () => {
    const parcel: any = {
      id: 'parcel-1',
      tracking_number: 'TRK-1',
      parcel_tx_id: '#1',
      status: ParcelStatus.IN_TRANSIT,
      is_return_parcel: false,
      is_inter_hub_transfer: true,
      created_at: date('2026-01-01T08:00:00Z'),
      updated_at: date('2026-01-01T12:00:00Z'),
      tracking_events: [
        {
          id: 'event-1',
          event_type: ParcelTrackingEventType.PARCEL_CREATED,
          title: 'Parcel created',
          description: 'Created',
          to_status: ParcelStatus.PENDING,
          actor_type: ParcelTrackingActorType.MERCHANT,
          source: 'MERCHANT_CREATE',
          occurred_at: date('2026-01-01T08:00:00Z'),
          is_public: true,
        },
        {
          id: 'event-2',
          event_type: ParcelTrackingEventType.HUB_TRANSFER_STARTED,
          title: 'Hub transfer started',
          description: 'Hub A to Hub B',
          from_hub_id: 'hub-a',
          from_hub_name: 'Hub A',
          to_hub_id: 'hub-b',
          to_hub_name: 'Hub B',
          to_status: ParcelStatus.IN_TRANSIT,
          occurred_at: date('2026-01-01T09:00:00Z'),
          is_public: true,
        },
        {
          id: 'event-3',
          event_type: ParcelTrackingEventType.HUB_TRANSFER_RECEIVED,
          title: 'Received at destination hub',
          hub_id: 'hub-b',
          hub_name: 'Hub B',
          to_status: ParcelStatus.IN_HUB,
          occurred_at: date('2026-01-01T10:00:00Z'),
          is_public: true,
        },
        {
          id: 'event-4',
          event_type: ParcelTrackingEventType.RETURNED_TO_HUB,
          title: 'Returned to hub',
          to_status: ParcelStatus.RETURNED_TO_HUB,
          occurred_at: date('2026-01-01T11:00:00Z'),
          is_public: true,
        },
        {
          id: 'event-5',
          event_type: ParcelTrackingEventType.HUB_TRANSFER_STARTED,
          title: 'Hub transfer started',
          description: 'Hub B to Hub C',
          from_hub_id: 'hub-b',
          from_hub_name: 'Hub B',
          to_hub_id: 'hub-c',
          to_hub_name: 'Hub C',
          to_status: ParcelStatus.IN_TRANSIT,
          occurred_at: date('2026-01-01T12:00:00Z'),
          is_public: true,
        },
      ],
    };

    const detail = toParcelDetail(parcel);

    expect(detail.tracking.direction).toBe('RETURN');
    expect(detail.tracking.is_returning).toBe(true);
    expect(
      detail.tracking.events.filter(
        (event: any) =>
          event.event_type === ParcelTrackingEventType.HUB_TRANSFER_STARTED,
      ),
    ).toHaveLength(2);
    expect(detail.tracking.events[0].route.to_hub.name).toBe('Hub C');
    expect(detail.tracking.event_count).toBe(5);
    expect(detail.tracking.timeline_order).toBe('DESC');
    expect(detail.tracking.events.map((event: any) => event.sequence)).toEqual([
      5, 4, 3, 2, 1,
    ]);
    expect(detail.tracking.events[0].occurred_at).toEqual(
      detail.tracking.events[0].timestamp,
    );
  });

  it('builds a compatible legacy timeline when a parcel has no stored events', async () => {
    const eventRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    const parcelRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    const service = new ParcelTrackingService(
      eventRepository as any,
      parcelRepository as any,
    );
    const parcel = {
      id: 'legacy-parcel',
      tracking_number: 'LEGACY-1',
      status: ParcelStatus.DELIVERED,
      created_at: date('2025-01-01T08:00:00Z'),
      picked_up_at: date('2025-01-01T09:00:00Z'),
      delivered_at: date('2025-01-01T15:00:00Z'),
      updated_at: date('2025-01-01T15:00:00Z'),
    } as Parcel;

    await service.enrichParcel(parcel);

    expect(parcel.tracking_events.map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        ParcelTrackingEventType.PARCEL_CREATED,
        ParcelTrackingEventType.PICKED_UP,
        ParcelTrackingEventType.DELIVERY_COMPLETED,
      ]),
    );
    expect(parcel.tracking_events.every((event) => event.is_public)).toBe(true);
  });

  it('loads every descendant in a chained return journey', async () => {
    const eventRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    const parcelRepository = {
      find: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'return-1',
            original_parcel_id: 'original-1',
            tracking_number: 'RTN-TRACK-1',
            status: ParcelStatus.RETURN_TO_MERCHANT,
            is_return_parcel: true,
            created_at: date('2026-01-01T12:00:00Z'),
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'return-2',
            original_parcel_id: 'return-1',
            tracking_number: 'RTN-TRACK-1-R2',
            status: ParcelStatus.DELIVERED,
            is_return_parcel: true,
            created_at: date('2026-01-02T12:00:00Z'),
          },
        ])
        .mockResolvedValueOnce([]),
    };
    const service = new ParcelTrackingService(
      eventRepository as any,
      parcelRepository as any,
    );
    const parcel = {
      id: 'original-1',
      tracking_number: 'TRACK-1',
      status: ParcelStatus.RETURN_TO_MERCHANT,
      created_at: date('2026-01-01T08:00:00Z'),
      updated_at: date('2026-01-01T12:00:00Z'),
    } as Parcel;

    await service.enrichParcel(parcel);

    expect(parcel.returnParcels.map((item) => item.tracking_number)).toEqual([
      'RTN-TRACK-1',
      'RTN-TRACK-1-R2',
    ]);
  });

  it('records a hub-to-hub departure with immutable route snapshots', async () => {
    const saved: any[] = [];
    const eventRepository = {
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        saved.push(value);
        return value;
      }),
    };
    const hubRepository = {
      findOne: jest.fn(async ({ where }: any) => ({
        id: where.id,
        branch_name: where.id === 'hub-a' ? 'Hub A' : 'Hub B',
      })),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === ParcelTrackingEvent) return eventRepository;
        if (entity === Hub) return hubRepository;
        return { findOne: jest.fn().mockResolvedValue(null) };
      }),
    };
    const subscriber = Object.create(
      ParcelTrackingSubscriber.prototype,
    ) as ParcelTrackingSubscriber;

    await subscriber.afterUpdate({
      entity: {
        id: 'parcel-1',
        status: ParcelStatus.IN_TRANSIT,
        current_hub_id: null,
        destination_hub_id: 'hub-b',
        assigned_rider_id: null,
      },
      databaseEntity: {
        id: 'parcel-1',
        status: ParcelStatus.IN_HUB,
        current_hub_id: 'hub-a',
        destination_hub_id: null,
        assigned_rider_id: null,
      },
      updatedColumns: [
        { propertyName: 'status' },
        { propertyName: 'current_hub_id' },
        { propertyName: 'destination_hub_id' },
      ],
      manager,
    } as any);

    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual(
      expect.objectContaining({
        event_type: ParcelTrackingEventType.HUB_TRANSFER_STARTED,
        from_hub_id: 'hub-a',
        from_hub_name: 'Hub A',
        to_hub_id: 'hub-b',
        to_hub_name: 'Hub B',
      }),
    );
  });

  it('records all operational address and parcel-detail changes without copying old values', async () => {
    const saved: any[] = [];
    const eventRepository = {
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        saved.push(value);
        return value;
      }),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === ParcelTrackingEvent) return eventRepository;
        return { findOne: jest.fn().mockResolvedValue(null) };
      }),
    };
    const subscriber = Object.create(
      ParcelTrackingSubscriber.prototype,
    ) as ParcelTrackingSubscriber;

    await subscriber.afterUpdate({
      entity: {
        id: 'parcel-1',
        status: ParcelStatus.PENDING,
        customer_name: 'Updated Recipient',
        customer_secondary_phone: '01800000000',
        product_description: 'Updated product',
        delivery_type: 2,
      },
      databaseEntity: {
        id: 'parcel-1',
        status: ParcelStatus.PENDING,
        customer_name: 'Original Recipient',
        customer_secondary_phone: null,
        product_description: 'Original product',
        delivery_type: 1,
      },
      updatedColumns: [],
      manager,
    } as any);

    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual(
      expect.objectContaining({
        event_type: ParcelTrackingEventType.PARCEL_DETAILS_UPDATED,
        metadata: {
          changed_fields: [
            'customer_name',
            'customer_secondary_phone',
            'product_description',
            'delivery_type',
          ],
        },
      }),
    );
    expect(JSON.stringify(saved[0].metadata)).not.toContain(
      'Original Recipient',
    );
  });

  it('does not hide detail edits when status changes in the same save', async () => {
    const saved: any[] = [];
    const eventRepository = {
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        saved.push(value);
        return value;
      }),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === ParcelTrackingEvent) return eventRepository;
        return { findOne: jest.fn().mockResolvedValue(null) };
      }),
    };
    const subscriber = Object.create(
      ParcelTrackingSubscriber.prototype,
    ) as ParcelTrackingSubscriber;

    await subscriber.afterUpdate({
      entity: {
        id: 'parcel-1',
        status: ParcelStatus.CANCELLED,
        customer_address: 'Updated address',
      },
      databaseEntity: {
        id: 'parcel-1',
        status: ParcelStatus.PENDING,
        customer_address: 'Original address',
      },
      updatedColumns: [],
      manager,
    } as any);

    expect(saved.map((event) => event.event_type)).toEqual([
      ParcelTrackingEventType.CANCELLED,
      ParcelTrackingEventType.PARCEL_DETAILS_UPDATED,
    ]);
  });

  it('backfills a return parcel with its actual initial hub status', async () => {
    const saved: any[] = [];
    const eventRepository = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        saved.push(value);
        return value;
      }),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === ParcelTrackingEvent) return eventRepository;
        return { findOne: jest.fn().mockResolvedValue(null) };
      }),
    };
    const subscriber = Object.create(
      ParcelTrackingSubscriber.prototype,
    ) as ParcelTrackingSubscriber;
    const createdAt = date('2026-01-01T08:00:00Z');

    await subscriber.afterUpdate({
      entity: {
        id: 'return-1',
        status: ParcelStatus.IN_HUB,
        is_return_parcel: true,
        created_at: createdAt,
        customer_name: 'Updated Merchant',
      },
      databaseEntity: {
        id: 'return-1',
        status: ParcelStatus.IN_HUB,
        is_return_parcel: true,
        created_at: createdAt,
        customer_name: 'Merchant',
      },
      updatedColumns: [],
      manager,
    } as any);

    expect(saved).toContainEqual(
      expect.objectContaining({
        event_type: ParcelTrackingEventType.RETURN_PARCEL_CREATED,
        to_status: ParcelStatus.IN_HUB,
        source: 'LEGACY_BACKFILL',
      }),
    );
  });

  it('moves every linked parcel into the pickup lifecycle without changing delivery assignment', async () => {
    const service = Object.create(
      PickupRequestsService.prototype,
    ) as PickupRequestsService;
    const parcels = [
      {
        id: 'parcel-1',
        pickup_request_id: 'pickup-1',
        status: ParcelStatus.PENDING,
        assigned_rider_id: null,
      },
      {
        id: 'parcel-2',
        pickup_request_id: 'pickup-1',
        status: ParcelStatus.PENDING,
        assigned_rider_id: null,
      },
    ];
    (service as any).parcelRepository = {
      find: jest.fn().mockResolvedValue(parcels),
      save: jest.fn(async (parcel) => parcel),
    };

    const updated = await (service as any).updateParcelPickupLifecycle(
      'pickup-1',
      ParcelStatus.OUT_FOR_PICKUP,
      ParcelTrackingActorType.HUB,
      'hub-1',
    );

    expect(updated).toBe(2);
    expect(parcels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: ParcelStatus.OUT_FOR_PICKUP,
          assigned_rider_id: null,
          tracking_context: expect.objectContaining({
            actor_type: ParcelTrackingActorType.HUB,
            actor_id: 'hub-1',
          }),
        }),
      ]),
    );
  });

  it('does not report a return as completed while its linked parcel is still moving', () => {
    const parcel: any = {
      id: 'original-1',
      tracking_number: 'TRK-RETURN',
      status: ParcelStatus.RETURN_TO_MERCHANT,
      created_at: date('2026-01-01T08:00:00Z'),
      updated_at: date('2026-01-01T12:00:00Z'),
      tracking_events: [
        {
          id: 'return-event',
          event_type: ParcelTrackingEventType.RETURN_TO_MERCHANT,
          title: 'Returning to merchant',
          to_status: ParcelStatus.RETURN_TO_MERCHANT,
          occurred_at: date('2026-01-01T12:00:00Z'),
          is_public: true,
        },
      ],
      returnParcels: [
        {
          id: 'return-1',
          tracking_number: 'RTN-TRK-RETURN',
          status: ParcelStatus.IN_HUB,
          is_return_parcel: true,
          created_at: date('2026-01-01T12:00:01Z'),
        },
      ],
    };

    const detail = toParcelDetail(parcel);

    expect(detail.tracking.is_terminal).toBe(true);
    expect(detail.tracking.is_journey_complete).toBe(false);
    expect(detail.tracking.is_returning).toBe(true);
    expect(detail.tracking.is_return_completed).toBe(false);
    expect(detail.tracking.linked_parcels.active_return.tracking_number).toBe(
      'RTN-TRK-RETURN',
    );
    expect(
      detail.tracking.lifecycle_milestones.find(
        (milestone: any) => milestone.key === 'finalized',
      ).is_completed,
    ).toBe(false);

    parcel.returnParcels[0].status = ParcelStatus.DELIVERED;
    const completed = toParcelDetail(parcel);
    expect(completed.tracking.is_returning).toBe(false);
    expect(completed.tracking.is_return_completed).toBe(true);
    expect(completed.tracking.is_journey_complete).toBe(true);
    expect(completed.tracking.linked_parcels.active_return).toBeNull();
  });

  it('generates stable tracking numbers for chained return parcels', async () => {
    const service = Object.create(ParcelsService.prototype) as ParcelsService;

    await expect(
      (service as any).generateReturnTrackingNumber('TRACK-100'),
    ).resolves.toBe('RTN-TRACK-100');
    await expect(
      (service as any).generateReturnTrackingNumber('RTN-TRACK-100'),
    ).resolves.toBe('RTN-TRACK-100-R2');
    await expect(
      (service as any).generateReturnTrackingNumber('RTN-TRACK-100-R2'),
    ).resolves.toBe('RTN-TRACK-100-R3');
    await expect(
      (service as any).generateReturnTrackingNumber('X'.repeat(50)),
    ).resolves.toHaveLength(50);
  });

  it('commits the original status, return parcel, and tracking event in one transaction', async () => {
    const service = Object.create(ParcelsService.prototype) as ParcelsService;
    const original: any = {
      id: 'original-1',
      merchant_id: 'merchant-1',
      store_id: 'store-1',
      store: {
        merchant_id: 'merchant-1',
        business_name: 'Merchant Store',
        phone_number: '01700000000',
      },
      merchant: null,
      status: ParcelStatus.RETURNED_TO_HUB,
      tracking_number: 'TRACK-1',
      merchant_order_id: 'ORDER-1',
      customer_address: 'Customer address',
      delivery_area: 'Merchant address',
      product_description: 'Product',
      product_price: 100,
      product_weight: 1,
      parcel_type: null,
      return_reason: 'Customer refused',
      created_at: date('2026-01-01T08:00:00Z'),
      updated_at: date('2026-01-01T12:00:00Z'),
    };
    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const manager = {
      createQueryBuilder: jest.fn(() => updateBuilder),
      save: jest.fn(async (_entity, parcel) => {
        parcel.id = 'return-1';
        return parcel;
      }),
    };
    (service as any).parcelRepository = {
      findOne: jest.fn().mockResolvedValue(original),
      create: jest.fn((value) => value),
      save: jest.fn(),
    };
    (service as any).merchantRepository = { findOne: jest.fn() };
    (service as any).parcelTrackingService = {
      ensurePersistedBaseline: jest.fn().mockResolvedValue(undefined),
      record: jest.fn().mockResolvedValue(undefined),
    };
    (service as any).dataSource = {
      transaction: jest.fn(async (work) => work(manager)),
    };
    (service as any).generateReturnTrackingNumber = jest
      .fn()
      .mockResolvedValue('RTN-TRACK-1');
    (service as any).generateParcelTxId = jest.fn().mockResolvedValue('#RTN1');
    (service as any).getParcelIdPrefix = jest.fn().mockReturnValue('RTN');
    (service as any).logger = { log: jest.fn(), error: jest.fn() };

    const result = await service.markReturnToMerchant(
      'original-1',
      'hub-1',
      'Return approved',
    );

    expect((service as any).dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenCalledWith(
      Parcel,
      expect.objectContaining({ tracking_number: 'RTN-TRACK-1' }),
    );
    expect(
      (service as any).parcelTrackingService.ensurePersistedBaseline,
    ).toHaveBeenCalledWith(original, manager);
    expect((service as any).parcelTrackingService.record).toHaveBeenCalledWith(
      'original-1',
      expect.objectContaining({
        related_parcel_id: 'return-1',
        to_status: ParcelStatus.RETURN_TO_MERCHANT,
      }),
      manager,
    );
    expect((service as any).parcelRepository.save).not.toHaveBeenCalled();
    expect(result.original_parcel.status).toBe(ParcelStatus.RETURN_TO_MERCHANT);
  });
});
