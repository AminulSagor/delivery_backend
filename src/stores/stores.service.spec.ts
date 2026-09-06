import { BadRequestException } from '@nestjs/common';
import { ParcelStatus } from '../parcels/entities/parcel.entity';
import { Store, StoreStatus } from './entities/store.entity';
import {
  STORE_DEACTIVATION_FINAL_STATUSES,
  StoresService,
} from './stores.service';

describe('StoresService store availability', () => {
  function createService(store: Store, unfinishedParcelCount: number) {
    const service = Object.create(StoresService.prototype) as StoresService;
    (service as any).findOne = jest.fn().mockResolvedValue(store);
    (service as any).storesRepository = {
      save: jest.fn().mockImplementation(async (value) => value),
    };
    (service as any).parcelRepository = {
      count: jest.fn().mockResolvedValue(unfinishedParcelCount),
    };
    (service as any).logger = { log: jest.fn() };
    return service;
  }

  const approvedStore = () =>
    ({
      id: '9709e313-9cf0-4d02-a217-c040283e86bf',
      status: StoreStatus.APPROVED,
    }) as Store;

  it('rejects deactivation while any parcel has not reached a final stage', async () => {
    const store = approvedStore();
    const service = createService(store, 2);

    await expect(
      service.setAvailability(store.id, 'merchant-user', false),
    ).rejects.toThrow(
      'Cannot deactivate this store because 2 parcels have not reached a final stage.',
    );
    expect(store.status).toBe(StoreStatus.APPROVED);
    expect((service as any).storesRepository.save).not.toHaveBeenCalled();
  });

  it('deactivates when every parcel is in an allowed final stage', async () => {
    const store = approvedStore();
    const service = createService(store, 0);

    const result = await service.setAvailability(
      store.id,
      'merchant-user',
      false,
    );

    expect(result.status).toBe(StoreStatus.DISABLED);
    expect((service as any).parcelRepository.count).toHaveBeenCalledWith({
      where: {
        store_id: store.id,
        status: expect.any(Object),
      },
    });
  });

  it('reactivates a disabled store without checking parcel stages', async () => {
    const store = approvedStore();
    store.status = StoreStatus.DISABLED;
    const service = createService(store, 99);

    const result = await service.setAvailability(
      store.id,
      'merchant-user',
      true,
    );

    expect(result.status).toBe(StoreStatus.APPROVED);
    expect((service as any).parcelRepository.count).not.toHaveBeenCalled();
  });

  it('uses exactly the configured final parcel statuses', () => {
    expect(STORE_DEACTIVATION_FINAL_STATUSES).toEqual([
      ParcelStatus.DELIVERED,
      ParcelStatus.RETURNED,
      ParcelStatus.PAID_RETURN,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.RETURN_TO_MERCHANT,
    ]);
  });

  it('does not reactivate pending or declined stores without admin approval', async () => {
    const store = approvedStore();
    store.status = StoreStatus.PENDING;
    const service = createService(store, 0);

    await expect(
      service.setAvailability(store.id, 'merchant-user', true),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
