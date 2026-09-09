import { ParcelsService } from './parcels.service';
import { ParcelStatus } from './entities/parcel.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { StoreStatus } from '../stores/entities/store.entity';
import { ForbiddenException } from '@nestjs/common';

describe('ParcelsService.bulkImportRows', () => {
  it('creates valid rows and preserves failures with spreadsheet row numbers', async () => {
    const service = Object.create(ParcelsService.prototype) as ParcelsService;
    (service as any).storeRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'store-1',
          merchant_id: 'merchant-1',
          business_address: 'Default store address',
        },
      ]),
    };
    service.getBulkSuggestions = jest.fn().mockResolvedValue([
      {
        original_row: {},
        status: 'SUCCESS',
        suggested_area_id: 'area-1',
      },
      {
        original_row: {},
        status: 'FAILED',
        error: 'Processing Error: No suitable coverage area found.',
      },
    ]);
    service.bulkCreateConfirmedBatch = jest.fn().mockResolvedValue({
      summary: { total: 1, success: 1, failed: 0 },
      results: [{ success: true, tracking: 'TRK-1' }],
    });

    const result = await service.bulkImportRows(
      [
        {
          row_number: 2,
          item: {
            store_id: 'store-1',
            customer_name: 'Valid Customer',
            customer_phone: '01712345678',
            customer_address: 'Mirpur, Dhaka',
            delivery_area: '',
            merchant_order_id: 'ORDER-1',
            product_price_raw: '100',
            product_weight_raw: '1',
          },
        },
        {
          row_number: 3,
          item: {
            customer_name: 'Invalid Customer',
            customer_phone: '01712345679',
            customer_address: 'Unknown address',
            delivery_area: 'Pickup address',
            product_price_raw: '0',
            product_weight_raw: '1',
          },
        },
      ],
      'user-1',
      'merchant-1',
    );

    expect(service.getBulkSuggestions).toHaveBeenCalledWith(
      [
        expect.objectContaining({ delivery_area: 'Default store address' }),
        expect.any(Object),
      ],
      'merchant-1',
    );
    expect(service.bulkCreateConfirmedBatch).toHaveBeenCalledWith(
      [expect.objectContaining({ delivery_coverage_area_id: 'area-1' })],
      'user-1',
      'merchant-1',
    );
    expect(result.summary).toEqual({ total: 2, success: 1, failed: 1 });
    expect(result.results).toEqual([
      {
        row_number: 2,
        merchant_order_id: 'ORDER-1',
        success: true,
        tracking: 'TRK-1',
      },
      {
        row_number: 3,
        merchant_order_id: undefined,
        success: false,
        error: 'Processing Error: No suitable coverage area found.',
      },
    ]);
  });
});

describe('ParcelsService.getBulkSuggestions', () => {
  function createService(prediction: any) {
    const service = Object.create(ParcelsService.prototype) as ParcelsService;
    (service as any).storeRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: '9709e313-9cf0-4d02-a217-c040283e86bf',
          merchant_id: 'merchant-1',
          business_address: 'Merchant pickup address',
          status: StoreStatus.APPROVED,
        },
      ]),
    };
    (service as any).coverageAreaRepository = { find: jest.fn() };
    (service as any).coverageAreasService = {
      suggestAreas: jest.fn().mockResolvedValue([prediction]),
    };
    (service as any).calculateCharges = jest.fn().mockResolvedValue({
      delivery_charge: 60,
      weight_charge: 10,
      cod_charge: 10,
      discount: 5,
      total_charge: 75,
      receivable_amount: 925,
    });
    return service;
  }

  const item = {
    row_id: 'row-1',
    store_id: '9709e313-9cf0-4d02-a217-c040283e86bf',
    customer_name: 'Customer',
    customer_phone: '01712345678',
    customer_address: 'Raw recipient address',
    address: 'Raw recipient address',
    fixedAddress: 'Corrected Barikoi address',
    addressStatus: 'complete',
    confidence: 82,
    barikoiScore: 1,
    city: 'Dhaka',
    area: 'Uttara',
    subArea: 'Sector 7',
    thana: 'Uttara',
    product_price_raw: '1000',
    product_weight_raw: '1',
    parcel_type_raw: '1',
    delivery_type_raw: '1',
  };

  it('uses the single-address payload and returns a full row result', async () => {
    const service = createService({
      division: 'Dhaka',
      city: 'Dhaka',
      city_id: 1,
      zone: 'Uttara',
      zone_id: 10,
      area: 'Sector 7',
      area_id: 100,
      coverage_area_uuid: '91b49d21-5fa2-4140-9d9f-4efefdef3ba1',
      inside_dhaka_flag: true,
      match_level: 'AREA',
      confidence: 1,
    });

    const result = await service.getBulkSuggestions([item], 'merchant-1');

    expect(
      (service as any).coverageAreasService.suggestAreas,
    ).toHaveBeenCalledWith([
      {
        address: 'Raw recipient address',
        fixedAddress: 'Corrected Barikoi address',
        addressStatus: 'complete',
        confidence: 82,
        barikoiScore: 1,
        city: 'Dhaka',
        area: 'Uttara',
        subArea: 'Sector 7',
        thana: 'Uttara',
      },
    ]);
    expect(result[0]).toEqual(
      expect.objectContaining({
        row_id: 'row-1',
        status: 'SUCCESS',
        coverage_area_uuid: '91b49d21-5fa2-4140-9d9f-4efefdef3ba1',
        suggested_city_id: 1,
        suggested_zone_id: 10,
        suggested_carrybee_area_id: 100,
        match_level: 'AREA',
        confidence: 1,
        delivery_charge: 60,
        weight_charge: 10,
        cod_charge: 10,
        discount: 5,
        total_charge: 75,
        receivable_amount: 925,
      }),
    );
    expect((service as any).calculateCharges).toHaveBeenCalledWith(
      'merchant-1',
      '91b49d21-5fa2-4140-9d9f-4efefdef3ba1',
      1,
      true,
      1000,
    );
  });

  it('returns RESOLVED without pricing when the algorithm finds only a zone', async () => {
    const service = createService({
      division: 'Dhaka',
      city: 'Dhaka',
      city_id: 1,
      zone: 'Uttara',
      zone_id: 10,
      area: null,
      area_id: null,
      coverage_area_uuid: null,
      inside_dhaka_flag: true,
      match_level: 'ZONE',
      confidence: 0.9,
    });

    const result = await service.getBulkSuggestions([item], 'merchant-1');

    expect(result[0]).toEqual(
      expect.objectContaining({
        row_id: 'row-1',
        status: 'RESOLVED',
        match_level: 'ZONE',
        coverage_area_uuid: null,
      }),
    );
    expect((service as any).calculateCharges).not.toHaveBeenCalled();
  });
});

describe('ParcelsService.bulkCreateConfirmedBatch', () => {
  it('keeps row_id and uses the selected store address as pickup address', async () => {
    const service = Object.create(ParcelsService.prototype) as ParcelsService;
    (service as any).storeRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: '9709e313-9cf0-4d02-a217-c040283e86bf',
          merchant_id: 'merchant-1',
          business_address: 'Merchant pickup address',
        },
      ]),
    };
    service.create = jest.fn().mockResolvedValue({
      tracking_number: 'TRK-1',
    });

    const result = await service.bulkCreateConfirmedBatch(
      [
        {
          row_id: 'row-1',
          store_id: '9709e313-9cf0-4d02-a217-c040283e86bf',
          delivery_coverage_area_id: '91b49d21-5fa2-4140-9d9f-4efefdef3ba1',
          customer_name: 'Customer',
          customer_phone: '01712345678',
          customer_address: 'Recipient address',
          product_price_raw: '1000',
          product_weight_raw: '1',
          parcel_type_raw: '1',
          delivery_type_raw: '1',
        },
      ],
      'user-1',
      'merchant-1',
    );

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_area: 'Merchant pickup address',
        product_price: 1000,
        product_weight: 1,
      }),
      'user-1',
      'merchant-1',
    );
    expect(result).toEqual({
      summary: { total: 1, success: 1, failed: 0 },
      results: [{ success: true, row_id: 'row-1', tracking: 'TRK-1' }],
    });
  });
});

describe('ParcelsService.findOne hub access', () => {
  const parcelId = '9709e313-9cf0-4d02-a217-c040283e86bf';

  function serviceWithParcel(parcel: any): ParcelsService {
    const service = Object.create(ParcelsService.prototype) as ParcelsService;
    (service as any).parcelRepository = {
      findOne: jest.fn().mockResolvedValue(parcel),
    };
    (service as any).parcelTrackingService = {
      enrichParcel: jest.fn().mockImplementation(async (value) => value),
    };
    (service as any).logger = { error: jest.fn() };
    return service;
  }

  it('allows a hub manager to view a parcel belonging to a store in their hub', async () => {
    const parcel = {
      id: parcelId,
      current_hub_id: null,
      store: { hub_id: 'hub-1' },
    };
    const service = serviceWithParcel(parcel);

    await expect(
      service.findOne(parcelId, null, false, null, 'hub-1'),
    ).resolves.toBe(parcel);
  });

  it('rejects a parcel that is neither at nor owned by the manager hub', async () => {
    const parcel = {
      id: parcelId,
      current_hub_id: 'hub-2',
      store: { hub_id: 'hub-3' },
    };
    const service = serviceWithParcel(parcel);

    await expect(
      service.findOne(parcelId, null, false, null, 'hub-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ParcelsService hub receipt timestamp', () => {
  const parcelId = '9709e313-9cf0-4d02-a217-c040283e86bf';

  function serviceWithParcel(parcel: any): ParcelsService {
    const service = Object.create(ParcelsService.prototype) as ParcelsService;
    (service as any).parcelRepository = {
      findOne: jest.fn().mockResolvedValue(parcel),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    (service as any).logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return service;
  }

  function receivableParcel() {
    return {
      id: parcelId,
      tracking_number: 'TRK-1',
      parcel_tx_id: 'PARCEL-1',
      status: ParcelStatus.PICKED_UP,
      current_hub_id: null,
      origin_hub_id: null,
      picked_up_at: new Date('2026-09-08T10:00:00.000Z'),
      received_at: null,
      store: { hub_id: 'hub-1', auto_assign_to_carrybee: false },
    };
  }

  it('sets received_at when receiving a single parcel', async () => {
    const parcel = receivableParcel();
    const service = serviceWithParcel(parcel);

    await service.markAsReceived(parcelId, 'hub-1');

    expect(parcel.received_at).toBeInstanceOf(Date);
    expect(parcel.status).toBe(ParcelStatus.IN_HUB);
  });

  it('sets received_at when bulk receiving parcels', async () => {
    const parcel = receivableParcel();
    const service = serviceWithParcel(parcel);

    const result = await service.bulkMarkAsReceived([parcelId], 'hub-1');

    expect(result.success).toBe(1);
    expect(parcel.received_at).toBeInstanceOf(Date);
    expect(parcel.status).toBe(ParcelStatus.IN_HUB);
  });
});

describe('ParcelsService charge consistency', () => {
  const baseParcel = () =>
    ({
      id: '9709e313-9cf0-4d02-a217-c040283e86bf',
      merchant_id: 'merchant-1',
      delivery_coverage_area_id: 'area-1',
      store: { hub_id: 'hub-1' },
      current_hub_id: 'hub-1',
      status: ParcelStatus.PENDING,
      product_price: 1000,
      product_weight: 1,
      cod_amount: 1000,
      is_cod: true,
      delivery_charge: 60,
      weight_charge: 10,
      cod_charge: 10,
      // Includes a fixed 5 BDT entry-time discount.
      total_charge: 75,
      receivable_amount: 925,
    }) as any;

  function serviceWithParcel(parcel: any): ParcelsService {
    const service = Object.create(ParcelsService.prototype) as ParcelsService;
    (service as any).parcelRepository = {
      findOne: jest.fn().mockResolvedValue(parcel),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    (service as any).logger = { log: jest.fn(), error: jest.fn() };
    return service;
  }

  it('recalculates only COD charge when collect amount changes', async () => {
    const parcel = baseParcel();
    parcel.status = ParcelStatus.IN_HUB;
    const service = serviceWithParcel(parcel);
    (service as any).calculateCharges = jest.fn();

    await service.update(
      parcel.id,
      { product_price: 2000 },
      { role: UserRole.HUB_MANAGER, hubId: 'hub-1' },
    );

    expect(parcel.delivery_charge).toBe(60);
    expect(parcel.weight_charge).toBe(10);
    expect(parcel.cod_charge).toBe(20);
    expect(parcel.total_charge).toBe(85);
    expect(parcel.receivable_amount).toBe(1915);
    expect((service as any).calculateCharges).not.toHaveBeenCalled();
  });

  it('derives weight charge from actual weight and preserves other charges', async () => {
    const parcel = baseParcel();
    const service = serviceWithParcel(parcel);
    (service as any).calculateCharges = jest.fn().mockResolvedValue({
      weight_charge: 30,
    });

    await service.updateHubCharges(
      parcel.id,
      {
        product_weight: 2.5,
        delivery_charge: 999,
        weight_charge: 999,
      },
      UserRole.HUB_MANAGER,
      'hub-1',
    );

    expect(parcel.product_weight).toBe(2.5);
    expect(parcel.delivery_charge).toBe(60);
    expect(parcel.weight_charge).toBe(30);
    expect(parcel.cod_charge).toBe(10);
    expect(parcel.total_charge).toBe(95);
    expect(parcel.receivable_amount).toBe(905);
  });

  it('keeps every charge unchanged when received weight is unchanged', async () => {
    const parcel = baseParcel();
    const service = serviceWithParcel(parcel);
    (service as any).calculateCharges = jest.fn();

    await service.updateHubCharges(
      parcel.id,
      {
        product_weight: 1,
        delivery_charge: 999,
        weight_charge: 999,
      },
      UserRole.HUB_MANAGER,
      'hub-1',
    );

    expect(parcel.delivery_charge).toBe(60);
    expect(parcel.weight_charge).toBe(10);
    expect(parcel.cod_charge).toBe(10);
    expect(parcel.total_charge).toBe(75);
    expect(parcel.receivable_amount).toBe(925);
    expect((service as any).calculateCharges).not.toHaveBeenCalled();
  });
});
