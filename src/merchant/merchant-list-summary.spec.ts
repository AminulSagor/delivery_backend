import { MerchantService } from './merchant.service';

describe('MerchantService merchant-list summary', () => {
  it('calculates summary from all filtered merchants, not only the current page', async () => {
    const currentPageMerchants = [
      {
        id: 'merchant-page',
        user: { full_name: 'Current Page Merchant' },
      },
    ];
    const allFilteredMerchants = [
      ...currentPageMerchants,
      {
        id: 'merchant-top',
        user: { full_name: 'Global Top Merchant' },
      },
    ];

    const summaryQuery = {
      getMany: jest.fn().mockResolvedValue(allFilteredMerchants),
    };
    const merchantQuery: any = {
      leftJoinAndSelect: jest.fn(),
      leftJoin: jest.fn(),
      clone: jest.fn().mockReturnValue(summaryQuery),
      skip: jest.fn(),
      take: jest.fn(),
      orderBy: jest.fn(),
      getManyAndCount: jest
        .fn()
        .mockResolvedValue([currentPageMerchants, allFilteredMerchants.length]),
    };
    merchantQuery.leftJoinAndSelect.mockReturnValue(merchantQuery);
    merchantQuery.leftJoin.mockReturnValue(merchantQuery);
    merchantQuery.skip.mockReturnValue(merchantQuery);
    merchantQuery.take.mockReturnValue(merchantQuery);
    merchantQuery.orderBy.mockReturnValue(merchantQuery);

    const parcelStatsQuery: any = {
      select: jest.fn(),
      addSelect: jest.fn(),
      where: jest.fn(),
      groupBy: jest.fn(),
      setParameters: jest.fn(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          merchant_id: 'merchant-page',
          total_delivered: '2',
          collected_amount: '200',
        },
        {
          merchant_id: 'merchant-top',
          total_delivered: '12',
          collected_amount: '1187',
        },
      ]),
    };
    parcelStatsQuery.select.mockReturnValue(parcelStatsQuery);
    parcelStatsQuery.addSelect.mockReturnValue(parcelStatsQuery);
    parcelStatsQuery.where.mockReturnValue(parcelStatsQuery);
    parcelStatsQuery.groupBy.mockReturnValue(parcelStatsQuery);
    parcelStatsQuery.setParameters.mockReturnValue(parcelStatsQuery);

    const merchantRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(merchantQuery),
    };
    const parcelRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(parcelStatsQuery),
    };

    const service = new MerchantService(
      merchantRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      parcelRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.findAll({ page: 1, limit: 1 });

    expect(result.data).toEqual(currentPageMerchants);
    expect(result.summary).toEqual({
      total_merchants: 2,
      top_merchant: {
        id: 'merchant-top',
        full_name: 'Global Top Merchant',
        successful_parcels: 12,
      },
      top_merchant_transaction: 1187,
      currency: 'BDT',
    });
    expect(parcelStatsQuery.where).toHaveBeenCalledWith(
      'parcel.merchant_id IN (:...merchantIds)',
      { merchantIds: ['merchant-page', 'merchant-top'] },
    );
  });
});
