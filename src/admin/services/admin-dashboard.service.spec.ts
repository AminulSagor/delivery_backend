/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { BadRequestException } from '@nestjs/common';
import { ParcelStatus } from '../../parcels/entities/parcel.entity';
import { AdminDashboardService } from './admin-dashboard.service';

function queryBuilder(result: { rawMany?: any[]; rawOne?: any }) {
  const builder: any = {};
  const chainMethods = [
    'leftJoin',
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'addGroupBy',
    'setParameter',
    'setParameters',
    'orderBy',
    'addOrderBy',
  ];

  for (const method of chainMethods) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.getRawMany = jest.fn().mockResolvedValue(result.rawMany ?? []);
  builder.getRawOne = jest.fn().mockResolvedValue(result.rawOne ?? {});
  return builder;
}

describe('AdminDashboardService', () => {
  it('returns the complete lightweight bootstrap contract for the screen', async () => {
    const service = new AdminDashboardService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    jest.spyOn(service as any, 'getParcelMetrics').mockResolvedValue({
      parcelsToProcess: 24,
      deliveriesInProgress: 75,
      receivedLastHour: 3,
      liveSuccessRate: 88.42,
      todaySuccessRateChange: 0.5,
    });
    jest.spyOn(service as any, 'getTodayParcelSummary').mockResolvedValue({
      currency: 'BDT',
      new_parcels: { count: 12, amount: 48000 },
      pick_up: { count: 45, amount: 48000 },
      assigned: { count: 23, amount: 48000 },
      delivered: { count: 12, amount: 48000 },
      delivery_rescheduled: { count: 7, amount: 48000 },
    });
    jest.spyOn(service as any, 'getRiderCounts').mockResolvedValue({
      total: 30,
      active: 15,
    });
    jest.spyOn(service as any, 'getHubCounts').mockResolvedValue({
      total: 130,
      active: 123,
    });
    jest.spyOn(service, 'getPendingActions').mockResolvedValue({
      counts: {
        rider_approval: 0,
        merchant_payment: 0,
        merchant_approval: 0,
        total: 0,
      },
      actions: [],
    });

    const result = await service.getOverview({ date: '2026-07-21' });

    expect(result.top_cards).toMatchObject({
      parcels_to_process: { value: 24, received_last_hour: 3 },
      riders_active: { value: 15, total: 30 },
      deliveries_in_progress: {
        value: 75,
        average_per_active_rider: 5,
      },
      total_active_hubs: { value: 123, total: 130 },
      live_success_rate: { value: 88.42, today_change: 0.5 },
    });
    expect(result.summary_for_todays_parcel.new_parcels.count).toBe(12);
    expect(result.quick_actions.map((action) => action.id)).toEqual([
      'manage_hubs',
      'view_reports',
      'approve_rider',
      'create_invoice',
      'all_parcels',
    ]);
    expect(result).not.toHaveProperty('parcel_flow');
    expect(result).not.toHaveProperty('earning_trends');
    expect(result).not.toHaveProperty('lifetime_summary');
  });

  it('returns pending actions with links to the existing approval and payment flows', async () => {
    const riderRepository = {
      findAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'rider-1',
            user: { full_name: 'Ahmed Wasi' },
            hub: { branch_name: 'Dhanmondi Branch' },
          },
        ],
        4,
      ]),
    };
    const invoiceRepository = {
      findAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'invoice-1',
            invoice_no: '#4234',
            payable_amount: '1250.50',
            merchant: { user: { full_name: 'TechHUB' } },
          },
        ],
        2,
      ]),
    };
    const merchantRepository = {
      findAndCount: jest
        .fn()
        .mockResolvedValue([
          [{ id: 'merchant-1', user: { full_name: 'Tech HUB' } }],
          3,
        ]),
    };
    const service = new AdminDashboardService(
      {} as any,
      riderRepository as any,
      {} as any,
      merchantRepository as any,
      invoiceRepository as any,
    );

    const result = await service.getPendingActions();

    expect(result.counts).toEqual({
      rider_approval: 4,
      merchant_payment: 2,
      merchant_approval: 3,
      total: 9,
    });
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'RIDER_APPROVAL',
          action_endpoint: '/riders/rider-1/approve',
        }),
        expect.objectContaining({
          type: 'MERCHANT_PAYMENT',
          amount: 1250.5,
          action_endpoint: '/merchant-invoices/invoice-1/pay',
        }),
        expect.objectContaining({
          type: 'MERCHANT_APPROVAL',
          action_endpoint: '/merchants/merchant-1/approve',
        }),
      ]),
    );
  });

  it('fills missing months with zero and separates each requested earning year', async () => {
    const parcelBuilder = queryBuilder({
      rawMany: [
        { year: '2025', month: '1', amount: '1000.25' },
        { year: '2026', month: '2', amount: '2500' },
      ],
    });
    const service = new AdminDashboardService(
      { createQueryBuilder: jest.fn().mockReturnValue(parcelBuilder) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getEarningTrends({
      start_year: 2025,
      end_year: 2026,
    });

    expect(result.series).toHaveLength(2);
    expect(result.series[0]).toMatchObject({ year: 2025, total: 1000.25 });
    expect(result.series[0].monthly[0]).toEqual({
      month: 1,
      label: 'January',
      amount: 1000.25,
    });
    expect(result.series[0].monthly[1].amount).toBe(0);
    expect(result.series[1].monthly[1].amount).toBe(2500);
    expect(result.revenue_components).toContain('return_charge');
  });

  it('rejects earning trend ranges larger than five years', async () => {
    const service = new AdminDashboardService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.getEarningTrends({ start_year: 2020, end_year: 2026 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('supports hub-scoped custom parcel flow ranges', async () => {
    const parcelBuilder = queryBuilder({
      rawOne: {
        received_count: '892',
        dispatched_count: '756',
        reported_count: '103',
      },
    });
    const hubRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'a0bd7d87-ecfa-40c5-a066-f9bad84a9629',
        hub_code: 'HUB-001',
        branch_name: 'Dhanmondi HUB',
        area: 'Dhanmondi',
        status: 'ACTIVE',
        is_active: true,
      }),
    };
    const service = new AdminDashboardService(
      { createQueryBuilder: jest.fn().mockReturnValue(parcelBuilder) } as any,
      {} as any,
      hubRepository as any,
      {} as any,
      {} as any,
    );

    const result = await service.getParcelFlow({
      hub_id: 'a0bd7d87-ecfa-40c5-a066-f9bad84a9629',
      start_date: '2026-07-01',
      end_date: '2026-07-21',
    });

    expect(result.metrics).toEqual({
      parcels_received: 892,
      parcels_dispatched: 756,
      parcels_reported: 103,
    });
    expect(result.scope).toMatchObject({
      type: 'HUB',
      hub: { branch_name: 'Dhanmondi HUB' },
    });
    expect(parcelBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('parcel.current_hub_id = :hubId'),
      { hubId: 'a0bd7d87-ecfa-40c5-a066-f9bad84a9629' },
    );
  });

  it('returns all lifetime cards from one aggregate query', async () => {
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
    const service = new AdminDashboardService(
      { createQueryBuilder: jest.fn().mockReturnValue(parcelBuilder) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getLifetimeSummary({});

    expect(result.total_parcel).toEqual({ count: 20, amount: 50000.25 });
    expect(result.partially_delivered).toEqual({ count: 2, amount: 5000 });
    expect(result.return_to_merchant).toEqual({ count: 1, amount: 2500 });
    expect(result.exchanged).toEqual({ count: 1, amount: 4000 });
    expect(result.currency).toBe('BDT');
    expect(parcelBuilder.getRawOne).toHaveBeenCalledTimes(1);
  });

  it('keeps flow status semantics aligned with the parcel lifecycle', () => {
    const service = new AdminDashboardService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    expect((service as any).inProgressStatuses).toEqual([
      ParcelStatus.ASSIGNED_TO_RIDER,
      ParcelStatus.ASSIGNED_TO_THIRD_PARTY,
      ParcelStatus.OUT_FOR_DELIVERY,
      ParcelStatus.IN_TRANSIT,
    ]);
  });
});
