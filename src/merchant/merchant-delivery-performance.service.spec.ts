import { MerchantService } from './merchant.service';

describe('MerchantService.getMerchantDeliveryPerformance', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns four chart-ready weekly buckets for a selected month', async () => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          bucket: new Date('2026-04-03T00:00:00.000Z'),
          total_count: '220',
          delivered_count: '180',
          returned_count: '40',
        },
        {
          bucket: new Date('2026-04-10T00:00:00.000Z'),
          total_count: '260',
          delivered_count: '200',
          returned_count: '60',
        },
        {
          bucket: new Date('2026-04-17T00:00:00.000Z'),
          total_count: '245',
          delivered_count: '198',
          returned_count: '47',
        },
        {
          bucket: new Date('2026-04-24T00:00:00.000Z'),
          total_count: '280',
          delivered_count: '220',
          returned_count: '60',
        },
      ]),
    };

    const service = Object.create(MerchantService.prototype) as MerchantService;
    Object.defineProperty(service, 'merchantRepository', {
      value: { findOne: jest.fn().mockResolvedValue({ id: 'merchant-1' }) },
    });
    Object.defineProperty(service, 'parcelRepo', {
      value: { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) },
    });

    const result = await service.getMerchantDeliveryPerformance('merchant-1', {
      performance_range: 'monthly',
      month: '2026-04',
    });

    expect(result.start_date).toBe('2026-04-01');
    expect(result.end_date).toBe('2026-04-30');
    expect(result.trend).toHaveLength(30);
    expect(result.chart.bucket_type).toBe('week');
    expect(result.chart.categories).toEqual(['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4']);
    expect(result.chart.series).toEqual([
      {
        key: 'delivered',
        name: 'Delivered',
        data: [180, 200, 198, 220],
      },
      {
        key: 'returned',
        name: 'Returned',
        data: [40, 60, 47, 60],
      },
      {
        key: 'total_parcel',
        name: 'Total Parcel',
        data: [220, 260, 245, 280],
      },
    ]);
    expect(result.chart.buckets).toEqual([
      {
        key: 'week_1',
        label: 'Wk 1',
        start_date: '2026-04-01',
        end_date: '2026-04-07',
        delivered: 180,
        returned: 40,
        total_parcel: 220,
      },
      {
        key: 'week_2',
        label: 'Wk 2',
        start_date: '2026-04-08',
        end_date: '2026-04-14',
        delivered: 200,
        returned: 60,
        total_parcel: 260,
      },
      {
        key: 'week_3',
        label: 'Wk 3',
        start_date: '2026-04-15',
        end_date: '2026-04-21',
        delivered: 198,
        returned: 47,
        total_parcel: 245,
      },
      {
        key: 'week_4',
        label: 'Wk 4',
        start_date: '2026-04-22',
        end_date: '2026-04-30',
        delivered: 220,
        returned: 60,
        total_parcel: 280,
      },
    ]);
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'parcel.merchant_id = :merchantId',
      { merchantId: 'merchant-1' },
    );
  });

  it('returns seven chart-ready day buckets for the weekly view', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-19T12:00:00.000Z'));

    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          bucket: new Date('2026-07-15T00:00:00.000Z'),
          total_count: '12',
          delivered_count: '9',
          returned_count: '3',
        },
      ]),
    };

    const service = Object.create(MerchantService.prototype) as MerchantService;
    Object.defineProperty(service, 'merchantRepository', {
      value: { findOne: jest.fn().mockResolvedValue({ id: 'merchant-1' }) },
    });
    Object.defineProperty(service, 'parcelRepo', {
      value: { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) },
    });

    const result = await service.getMerchantDeliveryPerformance('merchant-1', {
      performance_range: 'weekly',
    });

    expect(result.start_date).toBe('2026-07-13');
    expect(result.end_date).toBe('2026-07-19');
    expect(result.chart.bucket_type).toBe('day');
    expect(result.chart.categories).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    expect(result.chart.series[0].data).toEqual([0, 0, 9, 0, 0, 0, 0]);
    expect(result.chart.series[1].data).toEqual([0, 0, 3, 0, 0, 0, 0]);
    expect(result.chart.series[2].data).toEqual([0, 0, 12, 0, 0, 0, 0]);
  });
});
