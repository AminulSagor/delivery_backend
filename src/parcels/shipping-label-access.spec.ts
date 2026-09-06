import { ForbiddenException } from '@nestjs/common';
import { ParcelsService } from './parcels.service';

describe('ParcelsService shipping-label access', () => {
  function createService(parcels: any[]) {
    const service = Object.create(ParcelsService.prototype) as ParcelsService;
    (service as any).parcelRepository = {
      find: jest.fn().mockResolvedValue(parcels),
    };
    (service as any).parcelDetailRelations = [];
    return service;
  }

  it('allows a merchant to print its own labels in requested order', async () => {
    const service = createService([
      { id: 'parcel-2', merchant_id: 'merchant-1', current_hub_id: 'hub-1' },
      { id: 'parcel-1', merchant_id: 'merchant-1', current_hub_id: 'hub-1' },
    ]);

    const result = await service.findForShippingLabels(
      ['parcel-1', 'parcel-2'],
      'merchant-1',
      false,
      null,
    );

    expect(result.map((parcel) => parcel.id)).toEqual(['parcel-1', 'parcel-2']);
  });

  it('rejects a merchant trying to print another merchant parcel', async () => {
    const service = createService([
      { id: 'parcel-1', merchant_id: 'merchant-2', current_hub_id: 'hub-1' },
    ]);

    await expect(
      service.findForShippingLabels(['parcel-1'], 'merchant-1', false, null),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a hub printing a parcel outside its current hub', async () => {
    const service = createService([
      { id: 'parcel-1', merchant_id: 'merchant-1', current_hub_id: 'hub-2' },
    ]);

    await expect(
      service.findForShippingLabels(['parcel-1'], null, false, 'hub-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
