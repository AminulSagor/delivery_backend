import { ParcelStatus } from '../parcels/entities/parcel.entity';
import {
  AdminService,
  MERCHANT_CLEARANCE_FINAL_STATUSES,
} from './admin.service';

describe('AdminService merchant clearance', () => {
  it('queries only unpaid parcels in final lifecycle statuses', async () => {
    const parcelRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    const merchantRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    const service = Object.create(AdminService.prototype) as AdminService;
    (service as any).parcelRepository = parcelRepository;
    (service as any).merchantRepository = merchantRepository;

    await service.getMerchantClearanceList({ page: 1, limit: 10 });

    const where = parcelRepository.find.mock.calls[0][0].where;
    expect(where.paid_to_merchant).toBe(false);
    expect(where.status.value).toEqual(MERCHANT_CLEARANCE_FINAL_STATUSES);
    expect(MERCHANT_CLEARANCE_FINAL_STATUSES).toEqual([
      ParcelStatus.DELIVERED,
      ParcelStatus.RETURNED,
      ParcelStatus.PAID_RETURN,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.RETURN_TO_MERCHANT,
    ]);
  });

  it('classifies completed delivery and return outcomes correctly', async () => {
    const completedParcels = [
      {
        merchant_id: 'merchant-1',
        status: ParcelStatus.DELIVERED,
        cod_collected_amount: 100,
        delivery_charge: 10,
        return_charge: 0,
      },
      {
        merchant_id: 'merchant-1',
        status: ParcelStatus.PARTIAL_DELIVERY,
        cod_collected_amount: 50,
        delivery_charge: 5,
        return_charge: 0,
      },
      {
        merchant_id: 'merchant-1',
        status: ParcelStatus.EXCHANGE,
        cod_collected_amount: 25,
        delivery_charge: 5,
        return_charge: 0,
      },
      {
        merchant_id: 'merchant-1',
        status: ParcelStatus.RETURNED,
        cod_collected_amount: 0,
        cod_amount: 0,
        delivery_charge: 0,
        return_charge: 8,
      },
      {
        merchant_id: 'merchant-1',
        status: ParcelStatus.PAID_RETURN,
        cod_collected_amount: 0,
        cod_amount: 0,
        delivery_charge: 0,
        return_charge: 7,
      },
      {
        merchant_id: 'merchant-1',
        status: ParcelStatus.RETURN_TO_MERCHANT,
        cod_collected_amount: 0,
        cod_amount: 0,
        delivery_charge: 0,
        return_charge: 5,
      },
    ];
    const service = Object.create(AdminService.prototype) as AdminService;
    (service as any).parcelRepository = {
      find: jest.fn().mockResolvedValue(completedParcels),
    };
    (service as any).merchantRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'merchant-1',
          user: { full_name: 'Merchant One', phone: '01700000000' },
        },
      ]),
    };

    const result = await service.getMerchantClearanceList({});

    expect(result.merchants[0]).toMatchObject({
      total_parcels: 6,
      total_delivered: 3,
      total_returned: 3,
      total_collected_amount: 175,
      total_delivery_charge: 20,
      total_return_charge: 20,
      total_due_amount: 135,
    });
    expect(result.summary).toMatchObject({
      total_parcels: 6,
      total_delivered: 3,
      total_returned: 3,
    });
  });
});
