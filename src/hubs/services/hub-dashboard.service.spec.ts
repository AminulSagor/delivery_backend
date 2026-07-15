import { HubDashboardService } from './hub-dashboard.service';
import { HubDashboardRiderStatus } from '../dto/hub-dashboard-query.dto';
import { ParcelStatus } from '../../parcels/entities/parcel.entity';

function queryBuilder(result: {
  rawMany?: any[];
  rawOne?: any;
  manyAndCount?: [any[], number];
}) {
  const builder: any = {};
  const chainMethods = [
    'leftJoin',
    'leftJoinAndSelect',
    'innerJoinAndSelect',
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'addGroupBy',
    'setParameter',
    'setParameters',
    'orderBy',
    'skip',
    'take',
  ];

  for (const method of chainMethods) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }

  builder.getRawMany = jest.fn().mockResolvedValue(result.rawMany ?? []);
  builder.getRawOne = jest.fn().mockResolvedValue(result.rawOne ?? {});
  builder.getManyAndCount = jest
    .fn()
    .mockResolvedValue(result.manyAndCount ?? [[], 0]);
  builder.getCount = jest.fn().mockResolvedValue(0);
  return builder;
}

describe('HubDashboardService', () => {
  it('derives rider widget statuses without requiring new rider columns', async () => {
    const riderBuilder = queryBuilder({
      rawMany: [
        {
          id: 'rider-1',
          full_name: 'On Duty Rider',
          phone: '0101',
          is_active: true,
          assigned_count: '2',
          created_at: '2026-07-15T08:00:00.000Z',
        },
        {
          id: 'rider-2',
          full_name: 'Break Rider',
          phone: '0102',
          is_active: true,
          assigned_count: '0',
          created_at: '2026-07-15T07:00:00.000Z',
        },
        {
          id: 'rider-3',
          full_name: 'Leave Rider',
          phone: '0103',
          is_active: false,
          assigned_count: '0',
          created_at: '2026-07-15T06:00:00.000Z',
        },
      ],
    });
    const service = new HubDashboardService(
      {} as any,
      { createQueryBuilder: jest.fn().mockReturnValue(riderBuilder) } as any,
      {} as any,
    );

    const result = await service.getRiderStatus('hub-1', {
      status: HubDashboardRiderStatus.BREAK,
      page: 1,
      limit: 10,
      order: 'ASC',
      sortBy: 'full_name',
    });

    expect(result.counts).toEqual({
      all: 3,
      on_duty: 1,
      break: 1,
      leave: 1,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'rider-2',
      status: HubDashboardRiderStatus.BREAK,
      status_label: 'Break',
      assigned_parcels_count: 0,
    });
  });

  it('maps ongoing delivery rows into the dashboard table contract', async () => {
    const parcelBuilder = queryBuilder({
      manyAndCount: [
        [
          {
            id: 'parcel-1',
            parcel_tx_id: '#139679',
            tracking_number: 'TRK-139679',
            customer_address: 'Bashundhara, Dhaka',
            delivery_area: 'Dhaka',
            status: ParcelStatus.OUT_FOR_DELIVERY,
            updated_at: new Date('2026-07-15T08:00:00.000Z'),
            assignedRider: {
              id: 'rider-1',
              photo: null,
              bike_type: 'MOTORCYCLE',
              user: { full_name: 'Ahmed Wasi', phone: '0101' },
            },
            delivery_coverage_area: {
              area: 'Bashundhara',
              city: 'Dhaka',
              zone: 'Dhaka North',
            },
          },
        ],
        1,
      ],
    });
    const service = new HubDashboardService(
      { createQueryBuilder: jest.fn().mockReturnValue(parcelBuilder) } as any,
      {} as any,
      {} as any,
    );

    const result = await service.getOngoingDeliveries('hub-1', {
      page: 1,
      limit: 6,
      date: '2026-07-15',
    });

    expect(result.items[0]).toMatchObject({
      parcel_id: '#139679',
      status: ParcelStatus.OUT_FOR_DELIVERY,
      status_label: 'Out For Delivery',
      rider: {
        id: 'rider-1',
        name: 'Ahmed Wasi',
        phone: '0101',
      },
      destination: {
        area: 'Bashundhara',
        city: 'Dhaka',
      },
      actions: { can_view: true, can_call_rider: true },
    });
    expect(result.pagination).toMatchObject({ total: 1, totalPages: 1 });
    expect(parcelBuilder.where).toHaveBeenCalledWith(
      expect.stringContaining('parcel.current_hub_id = :hubId'),
      { hubId: 'hub-1' },
    );
  });

  it('returns every lifetime card from one hub-scoped aggregate query', async () => {
    const parcelBuilder = queryBuilder({
      rawOne: {
        total_count: '20',
        total_amount: '50000.25',
        delivered_count: '8',
        delivered_amount: '20000',
        partial_count: '2',
        partial_amount: '5000',
        paid_return_count: '1',
        paid_return_amount: '2500',
        return_count: '2',
        return_amount: '4000',
        pending_return_count: '1',
        pending_return_amount: '2000',
        pending_count: '4',
        pending_amount: '10000',
        return_to_merchant_count: '1',
        return_to_merchant_amount: '2500',
        exchanged_count: '1',
        exchanged_amount: '4000',
      },
    });
    const service = new HubDashboardService(
      { createQueryBuilder: jest.fn().mockReturnValue(parcelBuilder) } as any,
      {} as any,
      {} as any,
    );

    const result = await service.getLifetimeSummary('hub-1', {});

    expect(result.total_parcel).toEqual({ count: 20, amount: 50000.25 });
    expect(result.partially_delivered).toEqual({ count: 2, amount: 5000 });
    expect(result.return_to_merchant).toEqual({ count: 1, amount: 2500 });
    expect(result.currency).toBe('BDT');
    expect(parcelBuilder.where).toHaveBeenCalledWith(
      expect.stringContaining('parcel.current_hub_id = :hubId'),
      { hubId: 'hub-1' },
    );
  });
});
