import { BadRequestException } from '@nestjs/common';
import { StoreStatus } from '../stores/entities/store.entity';
import { PickupRequestsService } from './pickup-requests.service';

describe('PickupRequestsService store availability', () => {
  function createService() {
    const service = Object.create(
      PickupRequestsService.prototype,
    ) as PickupRequestsService;
    (service as any).storeRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'store-id',
        merchant_id: 'merchant-id',
        business_name: 'Test Store',
        hub_id: 'hub-id',
        status: StoreStatus.DISABLED,
      }),
    };
    (service as any).pickupRequestRepository = {
      findOne: jest.fn(),
    };
    (service as any).logger = { log: jest.fn() };
    return service;
  }

  it('rejects a manual pickup request for an inactive store', async () => {
    const service = createService();

    await expect(
      service.create('merchant-id', {
        store_id: 'store-id',
        estimated_parcels: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      (service as any).pickupRequestRepository.findOne,
    ).not.toHaveBeenCalled();
  });

  it('does not increment an existing pickup request for an inactive store', async () => {
    const service = createService();

    await expect(
      service.findOrCreateActiveForStore('merchant-id', 'store-id'),
    ).rejects.toThrow(
      'Pickup requests are unavailable because this store is not active',
    );
    expect(
      (service as any).pickupRequestRepository.findOne,
    ).not.toHaveBeenCalled();
  });
});

describe('PickupRequestsService hub search', () => {
  const pickup = {
    id: 'pickup-1',
    request_code: 'REQ-2001',
    store_id: 'store-1',
    estimated_parcels: 2,
    status: 'PENDING',
    assigned_rider_id: null,
    comment: 'Fragile',
    created_at: new Date('2026-09-12T08:00:00.000Z'),
    picked_up_at: new Date('2026-09-12T09:00:00.000Z'),
    store: {
      business_name: 'Test Store',
      phone_number: '01710000000',
      business_address: 'Uttara, Dhaka',
    },
    assignedRider: null,
    completedByRider: null,
  };

  function createQueryBuilder() {
    return {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[pickup], 1]),
      getMany: jest.fn().mockResolvedValue([pickup]),
    };
  }

  function createSearchService(
    queryBuilder: ReturnType<typeof createQueryBuilder>,
  ) {
    const service = Object.create(
      PickupRequestsService.prototype,
    ) as PickupRequestsService;
    (service as any).pickupRequestRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    (service as any).logger = {
      log: jest.fn(),
      error: jest.fn(),
    };
    return service;
  }

  it('applies server-side search to the pending request list', async () => {
    const queryBuilder = createQueryBuilder();
    const service = createSearchService(queryBuilder);

    const result = await service.findAllForHub(
      'hub-1',
      1,
      20,
      undefined,
      'created_at',
      'DESC',
      'Test Store',
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('pickup.request_code'),
      { search: '%test store%' },
    );
    expect(result.pagination.total).toBe(1);
    expect(result.items[0].request_code).toBe('REQ-2001');
  });

  it('applies search to assigned and completed pickup tabs', async () => {
    const assignedBuilder = createQueryBuilder();
    const assignedService = createSearchService(assignedBuilder);
    await assignedService.getAcceptedPickupsForHub('hub-1', 1, 20, '01710');

    const completedBuilder = createQueryBuilder();
    const completedService = createSearchService(completedBuilder);
    await completedService.getConfirmedPickupsForHub('hub-1', 1, 20, 'Uttara');

    expect(assignedBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('riderUser.full_name'),
      { search: '%01710%' },
    );
    expect(completedBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('completedRiderUser.full_name'),
      { search: '%uttara%' },
    );
  });
});
