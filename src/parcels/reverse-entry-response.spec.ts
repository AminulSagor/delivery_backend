import { ParcelsService } from './parcels.service';
import { ParcelStatus } from './entities/parcel.entity';

describe('Hub reverse-entry response contract', () => {
  const service = Object.create(ParcelsService.prototype) as ParcelsService;

  const merchant = {
    id: 'merchant-1',
    user: { full_name: 'Merchant Owner', phone: '01700000000' },
    merchant_profile: { profile_img_url: 'https://cdn.test/merchant.png' },
    full_address: 'Merchant fallback address',
  };
  const linkedStore = {
    id: 'store-1',
    merchant_id: 'merchant-1',
    business_name: 'Linked Store',
    business_address: 'Linked store address',
    phone_number: '01800000000',
    is_default: false,
    carrybee_city_id: 1,
    carrybee_zone_id: 10,
    carrybee_area_id: 100,
    district: 'Dhaka',
    thana: 'Dhanmondi',
    area: 'Dhanmondi',
    merchant,
  };
  const defaultStore = {
    ...linkedStore,
    id: 'store-2',
    business_name: 'Default Store',
    business_address: 'Default merchant destination',
    phone_number: '01900000000',
    is_default: true,
    carrybee_zone_id: 20,
    carrybee_area_id: 200,
    area: 'Banani',
    thana: 'Banani',
  };
  const parcel = {
    id: 'parcel-1',
    merchant_id: 'merchant-1',
    parcel_tx_id: 'MF123',
    merchant_order_id: 'ORDER-1',
    tracking_number: 'TRK-1',
    customer_name: 'Customer',
    customer_phone: '01600000000',
    customer_address: 'Customer destination',
    merchant,
    store: linkedStore,
    delivery_coverage_area: {
      zone_id: 30,
      zone: 'Mirpur',
      area_id: 300,
      area: 'Mirpur 10',
      city_id: 3,
      city: 'Dhaka',
      division: 'Dhaka',
      inside_dhaka_flag: true,
    },
    status: ParcelStatus.RETURNED,
    return_reason: 'Customer refused',
    cod_amount: 1000,
    cod_collected_amount: 0,
    delivery_charge: 70,
    cod_charge: 10,
    weight_charge: 20,
    total_charge: 90,
    return_charge: 60,
    reschedule_count: 2,
    created_at: new Date('2026-10-15T10:00:00Z'),
    updated_at: new Date('2026-10-16T10:00:00Z'),
  } as any;
  const stores = new Map([
    ['merchant-1', [defaultStore, linkedStore] as any[]],
  ]);

  it('returns the complete customer-destination list contract', () => {
    const item = (service as any).toDeliveryOutcomeItem(parcel, stores);

    expect(item).toMatchObject({
      merchant_order_id: 'ORDER-1',
      reason: 'Customer refused',
      customer_name: 'Customer',
      customer_phone: '01600000000',
      destination: 'Customer destination',
      zone: { id: 30, name: 'Mirpur' },
      merchant_name: 'Default Store',
      merchant_phone: '01900000000',
      merchant_image: 'https://cdn.test/merchant.png',
      charges: {
        cod_amount: 1000,
        delivery_charge: 70,
        cod_charge: 10,
        weight_charge: 20,
        discount: 10,
        return_charge: 60,
      },
    });
    expect(item.merchant.stores).toHaveLength(2);
    expect(item.merchant.stores[0].is_default).toBe(true);
    expect(item.age.display).toEqual(expect.any(String));
    expect(item.last_updated).toEqual(parcel.updated_at);
  });

  it('uses the default merchant store as the return destination', () => {
    const item = (service as any).toDeliveryOutcomeItem(
      { ...parcel, status: ParcelStatus.RETURN_TO_MERCHANT },
      stores,
      'MERCHANT',
    );

    expect(item.destination).toBe('Default merchant destination');
    expect(item.zone).toMatchObject({ id: 20, name: 'Banani' });
    expect(item.store).toMatchObject({
      id: 'store-2',
      is_default: true,
    });
  });
});
