import { HubsService } from './hubs.service';
import {
  HubConfirmationStatus,
  ParcelStatus,
} from '../parcels/entities/parcel.entity';

describe('HubsService merchant performance', () => {
  it('includes zero-parcel merchants and excludes unconfirmed financial outcomes', async () => {
    const stores = [
      {
        id: 'store-1',
        merchant_id: 'merchant-1',
        business_name: 'Top Store',
        business_address: 'Dhaka',
        phone_number: '0171',
        merchant: {
          full_address: 'Dhaka',
          user: { full_name: 'Top Merchant', phone: '0171', is_active: true },
        },
      },
      {
        id: 'store-2',
        merchant_id: 'merchant-2',
        business_name: 'New Store',
        business_address: 'Dhaka',
        phone_number: '0172',
        merchant: {
          full_address: 'Dhaka',
          user: { full_name: 'New Merchant', phone: '0172', is_active: true },
        },
      },
    ];
    const parcelBase = {
      store_id: 'store-1',
      merchant_id: 'merchant-1',
      status: ParcelStatus.DELIVERED,
      received_at: new Date('2026-09-12T08:00:00.000Z'),
      received_at_destination_hub: null,
      picked_up_at: null,
      created_at: new Date('2026-09-12T07:00:00.000Z'),
      cod_amount: 500,
      total_charge: 60,
      return_charge: 0,
      delivery_charge_applicable: true,
      return_charge_applicable: false,
    };
    const storeRepository = { find: jest.fn().mockResolvedValue(stores) };
    const parcelRepository = {
      find: jest.fn().mockResolvedValue([
        {
          ...parcelBase,
          id: 'parcel-1',
          cod_collected_amount: 500,
          hub_confirmation_status: HubConfirmationStatus.CONFIRMED,
        },
        {
          ...parcelBase,
          id: 'parcel-2',
          cod_collected_amount: 700,
          hub_confirmation_status: HubConfirmationStatus.PENDING,
        },
      ]),
    };

    const service = new HubsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
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

    const result = await service.getHubMerchantPerformance('hub-1', {
      page: 1,
      limit: 20,
    });

    expect(result.summary).toMatchObject({
      total_merchants: 2,
      active_merchants: 2,
      total_stores: 2,
      total_parcels: 2,
      delivered_parcels: 1,
      total_transactions: 500,
      total_platform_charge: 60,
      top_merchant: {
        merchant_id: 'merchant-1',
        successful_parcels: 1,
      },
    });
    expect(result.merchants).toHaveLength(2);
    expect(result.merchants).toContainEqual(
      expect.objectContaining({
        merchant_id: 'merchant-2',
        total_parcels: 0,
      }),
    );
  });
});
