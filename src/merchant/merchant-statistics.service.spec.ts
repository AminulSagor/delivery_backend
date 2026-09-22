import { MerchantService } from './merchant.service';

function builder(result: Record<string, unknown> = {}) {
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'leftJoin',
    'leftJoinAndSelect',
    'where',
    'andWhere',
    'select',
    'addSelect',
    'setParameters',
    'groupBy',
    'orderBy',
  ]) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb.getRawOne = jest.fn().mockResolvedValue(result.rawOne ?? {});
  qb.getRawMany = jest.fn().mockResolvedValue(result.rawMany ?? []);
  qb.getCount = jest.fn().mockResolvedValue(result.count ?? 0);
  qb.getMany = jest.fn().mockResolvedValue(result.many ?? []);
  return qb;
}

describe('MerchantService statistics', () => {
  it('returns received value and confirmed platform charge for the flow graph', async () => {
    const root = builder();
    const clones = [
      builder({
        rawOne: {
          received_count: '3',
          received_value: '1200.50',
          platform_charge: '180',
        },
      }),
      builder({ count: 3 }),
      builder({ count: 2 }),
      builder({ count: 1 }),
      builder({ count: 0 }),
      builder({
        rawMany: [
          {
            bucket: '2026-09-12',
            received_count: '3',
            received_value: '1200.50',
            platform_charge: '180',
          },
        ],
      }),
      builder({ many: [] }),
    ];
    root.clone = jest.fn();
    for (const clone of clones) root.clone.mockReturnValueOnce(clone);

    const merchantRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'merchant-1',
        status: 'APPROVED',
        user: { full_name: 'Merchant', phone: '0170', email: null },
      }),
    };
    const storeRepository = {
      count: jest.fn().mockResolvedValue(1),
      findOne: jest.fn().mockResolvedValue({
        business_name: 'Store',
        business_address: 'Dhaka',
      }),
    };
    const parcelRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(root),
    };
    const service = new MerchantService(
      merchantRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      storeRepository as any,
      parcelRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getMerchantOverview('merchant-1', {
      startDate: '2026-09-12',
      endDate: '2026-09-12',
    });

    expect(result.parcel_flow_totals).toMatchObject({
      received_count: 3,
      received_value: 1200.5,
      platform_charge: 180,
      currency: 'BDT',
    });
    expect(result.graph).toEqual([
      {
        bucket: '2026-09-12',
        received_count: 3,
        received_value: 1200.5,
        platform_charge: 180,
      },
    ]);
    expect(clones[0].addSelect).toHaveBeenCalledWith(
      expect.stringContaining('hub_confirmation_status'),
      'platform_charge',
    );
  });
});
