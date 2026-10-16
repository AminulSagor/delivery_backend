import { ParcelsService } from './parcels.service';
import { ParcelStatus } from './entities/parcel.entity';

describe('Rider merchant return tasks', () => {
  const merchant = {
    id: 'merchant-1',
    full_address: 'Merchant fallback address',
    user: { full_name: 'Merchant Owner', phone: '01700000000' },
    merchant_profile: { profile_img_url: 'https://cdn.test/merchant.png' },
  };
  const store = {
    id: 'store-1',
    merchant_id: 'merchant-1',
    business_name: 'Booklet Design BD',
    business_address: 'Bashundhara, Dhaka',
    phone_number: '01801234567',
    is_default: true,
    merchant,
  };
  const returnParcels = [
    {
      id: 'return-1',
      merchant_id: 'merchant-1',
      merchant,
      store,
      parcel_tx_id: 'MR1001',
      tracking_number: 'RTN-1',
      status: ParcelStatus.ASSIGNED_TO_RIDER,
      originalParcel: {
        id: 'original-1',
        parcel_tx_id: 'MF1001',
        tracking_number: 'TRK-1',
        customer_name: 'Farzana Rahman',
        customer_phone: '01900000001',
      },
    },
    {
      id: 'return-2',
      merchant_id: 'merchant-1',
      merchant,
      store,
      parcel_tx_id: 'MR1002',
      tracking_number: 'RTN-2',
      status: ParcelStatus.ASSIGNED_TO_RIDER,
      originalParcel: {
        id: 'original-2',
        parcel_tx_id: 'MF1002',
        tracking_number: 'TRK-2',
        customer_name: 'Urmi Akhter',
        customer_phone: '01900000002',
      },
    },
  ] as any[];

  it('groups return parcels by merchant and exposes original customers', async () => {
    const service = Object.create(ParcelsService.prototype) as ParcelsService;
    (service as any).findRiderReturnTaskParcels = jest
      .fn()
      .mockResolvedValue(returnParcels);
    (service as any).getMerchantStoresMap = jest
      .fn()
      .mockResolvedValue(new Map([['merchant-1', [store]]]));

    const result = await service.getRiderReturnTasks('rider-1', 'pending');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      merchant_id: 'merchant-1',
      name: 'Booklet Design BD',
      address: 'Bashundhara, Dhaka',
      phone: '01801234567',
      number_of_parcels: 2,
    });
    expect(result[0].parcels).toEqual([
      expect.objectContaining({
        parcel_id: 'MF1001',
        customer_name: 'Farzana Rahman',
        customer_phone: '01900000001',
      }),
      expect.objectContaining({
        parcel_id: 'MF1002',
        customer_name: 'Urmi Akhter',
        customer_phone: '01900000002',
      }),
    ]);
  });

  it('completes all merchant return parcels in one transaction', async () => {
    const service = Object.create(ParcelsService.prototype) as ParcelsService;
    const parcels = returnParcels.map((parcel) => ({ ...parcel }));
    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(parcels),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      }),
      save: jest.fn().mockResolvedValue(parcels),
    };
    (service as any).dataSource = {
      transaction: jest.fn(async (work) => work(manager)),
    };

    const result = await service.completeRiderReturnTask(
      'merchant-1',
      'rider-1',
    );

    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(result.parcel_count).toBe(2);
    expect(parcels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: ParcelStatus.RETURN_TO_MERCHANT,
          rider_action_status: ParcelStatus.RETURN_TO_MERCHANT,
          rider_action_rider_id: 'rider-1',
        }),
      ]),
    );
  });
});
