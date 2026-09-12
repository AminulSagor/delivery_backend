import { BadRequestException } from '@nestjs/common';
import {
  ParcelAssignmentFilter,
  ParcelQueryDto,
} from '../dto/parcel-query.dto';
import { ParcelStatus } from '../entities/parcel.entity';
import { ParcelQueryService } from './parcel-query.service';
import {
  RiderParcelSummaryQueryDto,
  RiderParcelSummaryType,
} from '../../riders/dto/rider-parcel-summary-query.dto';

function queryBuilder(rawRows: any[] = []) {
  const builder: any = {
    leftJoinAndSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    groupBy: jest.fn(),
    orderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getCount: jest.fn().mockResolvedValue(2),
    getMany: jest.fn().mockResolvedValue([]),
    getRawMany: jest.fn().mockResolvedValue(rawRows),
    getRawOne: jest.fn().mockResolvedValue({ cod_amount: '0' }),
  };
  for (const method of [
    'leftJoinAndSelect',
    'where',
    'andWhere',
    'select',
    'addSelect',
    'groupBy',
    'orderBy',
    'skip',
    'take',
  ]) {
    builder[method].mockReturnValue(builder);
  }
  return builder;
}

describe('ParcelQueryService', () => {
  it('applies completed history and third-party provider filters together', async () => {
    const main = queryBuilder();
    const summary = queryBuilder([
      {
        status: ParcelStatus.DELIVERED,
        count: '2',
        cod_amount: '1000',
        total_charge: '120',
      },
    ]);
    main.clone = jest.fn().mockReturnValue(summary);
    const repository = { createQueryBuilder: jest.fn().mockReturnValue(main) };
    const service = new ParcelQueryService(repository as any);

    const result = await service.queryHubParcels('hub-1', {
      history: true,
      assignment: ParcelAssignmentFilter.THIRD_PARTY,
      providerId: '9709e313-9cf0-4d02-a217-c040283e86bf',
      search: 'customer',
    } as ParcelQueryDto);

    expect(main.andWhere).toHaveBeenCalledWith(
      'parcel.status IN (:...completedStatuses)',
      expect.objectContaining({
        completedStatuses: expect.arrayContaining([
          ParcelStatus.DELIVERED,
          ParcelStatus.RETURN_TO_MERCHANT,
        ]),
      }),
    );
    expect(main.andWhere).toHaveBeenCalledWith(
      'parcel.third_party_provider_id IS NOT NULL',
    );
    expect(main.andWhere).toHaveBeenCalledWith(
      'parcel.third_party_provider_id = :providerId',
      { providerId: '9709e313-9cf0-4d02-a217-c040283e86bf' },
    );
    expect(result.summary).toEqual({
      total: 2,
      by_status: { DELIVERED: 2 },
      cod_amount: 1000,
      total_charge: 120,
    });
  });

  it('rejects a non-completed status in history mode', async () => {
    const main = queryBuilder();
    main.clone = jest.fn().mockReturnValue(queryBuilder());
    const service = new ParcelQueryService({
      createQueryBuilder: jest.fn().mockReturnValue(main),
    } as any);

    await expect(
      service.queryHubParcels('hub-1', {
        history: true,
        status: ParcelStatus.IN_HUB,
      } as ParcelQueryDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('counts returns from explicit return-parcel assignments', async () => {
    const main = queryBuilder();
    const amount = queryBuilder();
    amount.getRawOne.mockResolvedValue({ cod_amount: '560' });
    main.clone = jest.fn().mockReturnValue(amount);
    const service = new ParcelQueryService({
      createQueryBuilder: jest.fn().mockReturnValue(main),
    } as any);

    const result = await service.queryRiderParcelSummary('rider-1', {
      type: RiderParcelSummaryType.RETURNED,
      page: 1,
      limit: 20,
    } as RiderParcelSummaryQueryDto);

    expect(main.andWhere).toHaveBeenCalledWith(
      'parcel.is_return_parcel = :isReturnParcel',
      { isReturnParcel: true },
    );
    expect(main.andWhere).toHaveBeenCalledWith(
      'parcel.assigned_at IS NOT NULL',
    );
    expect(result.total).toBe(2);
    expect(result.cod_amount).toBe(560);
  });
});
