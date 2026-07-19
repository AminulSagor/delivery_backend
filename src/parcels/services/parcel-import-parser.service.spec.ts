import * as ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { ParcelImportParserService } from './parcel-import-parser.service';

describe('ParcelImportParserService', () => {
  const service = new ParcelImportParserService();

  function createFile(
    originalname: string,
    buffer: Buffer,
  ): Express.Multer.File {
    return {
      originalname,
      buffer,
      fieldname: 'file',
      encoding: '7bit',
      mimetype: 'application/octet-stream',
      size: buffer.length,
      destination: '',
      filename: originalname,
      path: '',
      stream: Readable.from([]),
    };
  }

  it('parses quoted CSV rows and applies request defaults', async () => {
    const csv = Buffer.from(
      [
        'Customer Name,Phone,Delivery Address,Product Price,Weight,Parcel Type,Delivery Type',
        'Jane Doe,01712345678,"House 1, Mirpur, Dhaka","1,250",1.5,Parcel,Express',
      ].join('\n'),
      'utf8',
    );

    const rows = await service.parse(createFile('parcels.csv', csv), {
      store_id: '3f9a6865-18df-44bd-9088-7fc15d4df18c',
      delivery_area: 'Merchant pickup address',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].row_number).toBe(2);
    expect(rows[0].item).toMatchObject({
      store_id: '3f9a6865-18df-44bd-9088-7fc15d4df18c',
      customer_name: 'Jane Doe',
      customer_phone: '01712345678',
      customer_address: 'House 1, Mirpur, Dhaka',
      delivery_area: 'Merchant pickup address',
      product_price_raw: '1250',
      product_weight_raw: '1.5',
      parcel_type_raw: '1',
      delivery_type_raw: '2',
      is_cod_raw: 'TRUE',
    });
  });

  it('parses XLSX rows and restores a leading zero on numeric phone cells', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Parcels');
    worksheet.addRow([
      'customer_name',
      'customer_phone',
      'customer_address',
      'delivery_area',
    ]);
    worksheet.addRow([
      'John Doe',
      1712345678,
      'Uttara, Dhaka',
      'Store address',
    ]);
    const xlsx = await workbook.xlsx.writeBuffer();

    const rows = await service.parse(
      createFile('parcels.xlsx', Buffer.from(xlsx)),
    );

    expect(rows[0].item.customer_phone).toBe('01712345678');
    expect(rows[0].item.product_price_raw).toBe('0');
    expect(rows[0].item.product_weight_raw).toBe('0');
  });
});
