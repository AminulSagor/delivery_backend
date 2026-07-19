import { ParcelsService } from './parcels.service';

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
