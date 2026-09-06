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
