import { ShippingLabelLayout } from '../dto/shipping-label.dto';
import { Parcel } from '../entities/parcel.entity';
import { ShippingLabelService } from './shipping-label.service';

describe('ShippingLabelService', () => {
  const parcel = (suffix: string) =>
    ({
      id: `parcel-${suffix}`,
      tracking_number: `MSW20260905${suffix}`,
      parcel_tx_id: `MS-${suffix}`,
      merchant_order_id: `ORDER-${suffix}`,
      cod_amount: 450,
      product_weight: 0.5,
      customer_name: 'Tania Mirza',
      customer_phone: '01724757033',
      customer_address: 'Golden Tower, 4th Floor, Amborkhana, Sylhet',
      product_description: 'Fashion item',
      delivery_area: 'Mohammadpur, Dhaka',
      created_at: new Date('2026-09-05T12:00:00Z'),
      store: {
        business_name: 'New Classic Collection BD',
        store_code: 'NCC001',
        hub: { branch_name: 'Mohammadpur Hub' },
      },
      delivery_coverage_area: { zone: 'Sylhet Sadar' },
    }) as Parcel;

  it('generates a non-empty A4 PDF containing two labels', async () => {
    const service = new ShippingLabelService();
    const pdf = await service.generate(
      [parcel('001'), parcel('002')],
      ShippingLabelLayout.A4,
    );

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(5000);
  });

  it('generates a thermal PDF for one label', async () => {
    const service = new ShippingLabelService();
    const pdf = await service.generate(
      [parcel('003')],
      ShippingLabelLayout.THERMAL,
    );

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(3000);
  });
});
