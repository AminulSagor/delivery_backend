import { CarrybeeService } from './carrybee.service';
import { ParcelStatus } from '../parcels/entities/parcel.entity';

describe('CarrybeeService (unit)', () => {
  it('assigns parcel to Carrybee (auto-sync + create order)', async () => {
    // Mocks
    const mockStore: any = {
      id: 'store-1',
      business_name: 'Parcel Store',
      business_address: 'Addr',
      phone_number: '01700000004',
      carrybee_city_id: 1,
      carrybee_zone_id: 1,
      carrybee_area_id: 1,
      district: 'D1',
      thana: 'T1',
      area: 'A1',
      is_carrybee_synced: false,
      carrybee_store_id: null,
      merchant: { user: { full_name: 'Merchant Test' } },
    };

    const mockParcel: any = {
      id: 'parcel-1',
      merchant_id: 'm1',
      store: mockStore,
      tracking_number: 'T123',
      delivery_area: 'Area X',
      customer_name: 'Alice',
      customer_phone: '01700000005',
      customer_address: 'Customer address here',
      product_weight: 1.5,
      cod_amount: 0,
      is_cod: false,
      status: ParcelStatus.IN_HUB,
      current_hub_id: 'hub-1',
      delivery_coverage_area: { city_id: 1, zone_id: 1, area_id: 1 },
    };

    const mockProvider = {
      id: 'prov-1',
      provider_code: 'CARRYBEE',
      is_active: true,
    };

    const parcelRepository: any = {
      findOne: jest.fn().mockResolvedValue(mockParcel),
      save: jest.fn().mockResolvedValue(true),
    };

    const storeRepository: any = {
      save: jest.fn().mockImplementation((s: any) => Promise.resolve(s)),
      findOne: jest.fn(),
    };

    const merchantRepository: any = { findOne: jest.fn() };
    const providerRepository: any = {
      findOne: jest.fn().mockResolvedValue(mockProvider),
    };
    const coverageAreaRepository: any = {};

    const mockCarrybeeApi: any = {
      formatPhoneForCarrybee: (p: string) => p,
      // first call returns empty, second call returns created store
      getStores: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValue([{ id: 'cb_store_1', name: 'Parcel Store' }]),
      createStore: jest.fn().mockResolvedValue({ success: true }),
      convertWeightToGrams: jest.fn((kg: number) =>
        Math.round(Number(kg) * 1000),
      ),
      mapDeliveryType: jest.fn((t: any) => t || 1),
      createOrder: jest.fn().mockResolvedValue({
        consignment_id: 'cons-1',
        delivery_fee: '50',
        cod_fee: 0,
      }),
    };

    const svc = new CarrybeeService(
      storeRepository,
      merchantRepository,
      parcelRepository,
      providerRepository,
      coverageAreaRepository,
      mockCarrybeeApi,
    );

    const res = await svc.assignParcelToCarrybee(
      mockParcel.id,
      {} as any,
      'hub-1',
    );

    expect(res).toBeDefined();
    expect(res.carrybee_consignment_id).toBe('cons-1');
    expect(mockCarrybeeApi.createOrder).toHaveBeenCalled();
    expect(parcelRepository.save).toHaveBeenCalled();
  });
});
