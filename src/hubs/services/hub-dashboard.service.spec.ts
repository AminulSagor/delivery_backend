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

  it('omits the live delivery map from overview responses', async () => {
    const service = new HubDashboardService({} as any, {} as any, {} as any);

    jest.spyOn(service as any, 'getParcelMetrics').mockResolvedValue({
      parcelsToProcess: 1,
      deliveriesInProgress: 1,
      receivedLastHour: 1,
      liveSuccessRate: 100,
      todaySuccessRateChange: 0,
    });
    jest.spyOn(service as any, 'getTodayParcelSummary').mockResolvedValue({
      currency: 'BDT',
      new_parcels: { count: 0, amount: 0 },
      pick_up: { count: 0, amount: 0 },
      assigned: { count: 0, amount: 0 },
      delivered: { count: 0, amount: 0 },
      delivery_rescheduled: { count: 0, amount: 0 },
    });
    jest.spyOn(service as any, 'getRiderCounts').mockResolvedValue({
      total: 1,
      active: 1,
    });
    jest.spyOn(service as any, 'getParcelFlowForRange').mockResolvedValue({
      range: {
        start_date: '2026-07-15',
        end_date: '2026-07-15',
        start: '2026-07-15T00:00:00.000Z',
        end_exclusive: '2026-07-16T00:00:00.000Z',
      },
      metrics: { parcels_received: 0, parcels_dispatched: 0, parcels_reported: 0 },
    });
    jest.spyOn(service as any, 'getPendingActions').mockResolvedValue({
      counts: {
        otp_approval: 0,
        rider_assignment: 0,
        return_processing: 0,
        total: 0,
      },
      actions: [],
    });
    jest.spyOn(service as any, 'getRiderStatus').mockResolvedValue({
      counts: { all: 0, on_duty: 0, break: 0, leave: 0 },
      items: [],
      pagination: { total: 0, page: 1, limit: 5, totalPages: 0, hasNext: false, hasPrev: false },
    });
    jest.spyOn(service as any, 'getOngoingDeliveries').mockResolvedValue({
      items: [],
      pagination: { total: 0, page: 1, limit: 6, totalPages: 0, hasNext: false, hasPrev: false },
    });
    jest.spyOn(service as any, 'getLifetimeSummary').mockResolvedValue({
      date_range: { start_date: null, end_date: null },
      currency: 'BDT',
      total_parcel: { count: 0, amount: 0 },
      delivered: { count: 0, amount: 0 },
      partially_delivered: { count: 0, amount: 0 },
      paid_return: { count: 0, amount: 0 },
      return: { count: 0, amount: 0 },
      pending_return: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      return_to_merchant: { count: 0, amount: 0 },
      exchanged: { count: 0, amount: 0 },
    });

    const result = await service.getOverview('hub-1', { date: '2026-07-15' } as any);

    expect(result).not.toHaveProperty('live_delivery_map');
  });
});
