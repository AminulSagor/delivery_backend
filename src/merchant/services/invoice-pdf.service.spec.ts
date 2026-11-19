import { InvoicePdfService } from './invoice-pdf.service';

describe('InvoicePdfService', () => {
  it('generates a printable PDF containing multiple parcel rows', async () => {
    const service = new InvoicePdfService();
    const parcels = Array.from({ length: 30 }, (_, index) => ({
      parcel_info: {
        tracking_number: `TRK-${String(index + 1).padStart(5, '0')}`,
        order_id: `ORDER-${index + 1}`,
      },
      financial_info: {
        receivable_amount: 900,
        breakdown: {
          collected_amount: 1000,
          total_fee: 100,
          return_charge: 0,
        },
      },
      status_info: { order_status: 'DELIVERED' },
    }));

    const pdf = await service.generate({
      invoice: {
        invoice_no: 'MI-TEST-001',
        transaction_id: 'TXN-TEST-001',
        date: '2026-10-27T10:00:00.000Z',
        status: 'UNPAID',
        paid_at: null,
        payment_reference: null,
      },
      merchant: { name: 'Test Merchant', phone: '01700000000' },
      payment_method: { method_type: 'BANK_ACCOUNT' },
      summary: {
        total_parcels: parcels.length,
        total_cod_collected: 30000,
        total_delivery_charges: 3000,
        total_return_charges: 0,
        payable_amount: 27000,
      },
      parcels,
    });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(5000);
  });
});
