import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { extname } from 'path';
import { Readable } from 'stream';
import {
  BulkImportDefaultsDto,
  ParsedBulkImportRow,
} from '../dto/bulk-import.dto';
import { BulkOrderItemDto } from '../dto/bulk-suggest.dto';

@Injectable()
export class ParcelImportParserService {
  static readonly MAX_IMPORT_ROWS = 1000;
  static readonly SUPPORTED_EXTENSIONS = ['.csv', '.xlsx'];

  private readonly headerAliases: Partial<
    Record<keyof BulkOrderItemDto, string[]>
  > = {
    store_id: ['store_id', 'store id', 'store'],
    customer_name: [
      'customer_name',
      'customer name',
      'recipient_name',
      'recipient name',
      'name',
    ],
    customer_phone: [
      'customer_phone',
      'customer phone',
      'recipient_phone',
      'recipient phone',
      'phone',
      'mobile',
    ],
    customer_secondary_phone: [
      'customer_secondary_phone',
      'customer secondary phone',
      'secondary_phone',
      'secondary phone',
      'alternate_phone',
      'alternate phone',
    ],
    customer_address: [
      'customer_address',
      'customer address',
      'recipient_address',
      'recipient address',
      'delivery_address',
      'delivery address',
      'address',
    ],
    delivery_area: [
      'delivery_area',
      'delivery area',
      'pickup_address',
      'pickup address',
      'pickup_area',
      'pickup area',
    ],
    delivery_coverage_area_id: [
      'delivery_coverage_area_id',
      'delivery coverage area id',
      'coverage_area_id',
      'coverage area id',
    ],
    merchant_order_id: [
      'merchant_order_id',
      'merchant order id',
      'order_id',
      'order id',
      'invoice_id',
      'invoice id',
    ],
    product_description: [
      'product_description',
      'product description',
      'description',
      'product',
    ],
    product_price_raw: [
      'product_price_raw',
      'product_price',
      'product price',
      'cod_amount',
      'cod amount',
      'price',
      'amount',
    ],
    product_weight_raw: [
      'product_weight_raw',
      'product_weight',
      'product weight',
      'weight',
      'weight_kg',
      'weight kg',
    ],
    parcel_type_raw: ['parcel_type_raw', 'parcel_type', 'parcel type', 'type'],
    delivery_type_raw: [
      'delivery_type_raw',
      'delivery_type',
      'delivery type',
      'service_type',
      'service type',
    ],
    is_cod_raw: ['is_cod_raw', 'is_cod', 'is cod', 'cod', 'cash_on_delivery'],
    is_exchange_raw: [
      'is_exchange_raw',
      'is_exchange',
      'is exchange',
      'exchange',
    ],
    special_instructions: [
      'special_instructions',
      'special instructions',
      'instructions',
      'note',
      'notes',
    ],
  };

  async parse(
    file: Express.Multer.File,
    defaults: BulkImportDefaultsDto = {},
  ): Promise<ParsedBulkImportRow[]> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('A non-empty CSV or XLSX file is required');
    }

    const extension = extname(file.originalname || '').toLowerCase();
    if (!ParcelImportParserService.SUPPORTED_EXTENSIONS.includes(extension)) {
      throw new BadRequestException('Only .csv and .xlsx files are supported');
    }

    const worksheet = await this.readWorksheet(file.buffer, extension);
    const headerRowNumber = this.findHeaderRowNumber(worksheet);
    if (!headerRowNumber) {
      throw new BadRequestException('The uploaded file is empty');
    }

    const columnMap = this.buildColumnMap(worksheet.getRow(headerRowNumber));
    this.validateRequiredHeaders(columnMap);

    const parsedRows: ParsedBulkImportRow[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= headerRowNumber || !this.rowHasData(row)) {
        return;
      }

      const values = this.readMappedValues(row, columnMap);
      const productPrice = this.normalizeNumericRaw(values.product_price_raw);

      const item: BulkOrderItemDto = {
        customer_name: values.customer_name || '',
        customer_phone: this.normalizePhone(values.customer_phone),
        customer_address: values.customer_address || '',
        delivery_area: values.delivery_area || defaults.delivery_area || '',
        product_price_raw: productPrice || '0',
        product_weight_raw:
          this.normalizeNumericRaw(values.product_weight_raw) || '0',
        is_cod_raw: this.normalizeBoolean(
          values.is_cod_raw,
          Number(productPrice || 0) > 0,
        ),
      };

      this.assignIfPresent(
        item,
        'customer_secondary_phone',
        this.normalizePhone(values.customer_secondary_phone),
      );
      this.assignIfPresent(
        item,
        'store_id',
        values.store_id || defaults.store_id,
      );
      this.assignIfPresent(
        item,
        'delivery_coverage_area_id',
        values.delivery_coverage_area_id,
      );
      this.assignIfPresent(item, 'merchant_order_id', values.merchant_order_id);
      this.assignIfPresent(
        item,
        'product_description',
        values.product_description,
      );
      this.assignIfPresent(
        item,
        'parcel_type_raw',
        this.normalizeParcelType(values.parcel_type_raw),
      );
      this.assignIfPresent(
        item,
        'delivery_type_raw',
        this.normalizeDeliveryType(values.delivery_type_raw),
      );
      this.assignIfPresent(
        item,
        'is_exchange_raw',
        values.is_exchange_raw
          ? this.normalizeBoolean(values.is_exchange_raw, false)
          : undefined,
      );
      this.assignIfPresent(
        item,
        'special_instructions',
        values.special_instructions,
      );

      parsedRows.push({ row_number: rowNumber, item });
    });

    if (parsedRows.length === 0) {
      throw new BadRequestException('The uploaded file has no parcel rows');
    }

    if (parsedRows.length > ParcelImportParserService.MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `A maximum of ${ParcelImportParserService.MAX_IMPORT_ROWS} parcel rows can be imported at once`,
      );
    }

    return parsedRows;
  }

  private async readWorksheet(
    buffer: Buffer,
    extension: string,
  ): Promise<ExcelJS.Worksheet> {
    const workbook = new ExcelJS.Workbook();

    try {
      if (extension === '.xlsx') {
        const arrayBuffer = Uint8Array.from(buffer).buffer;
        await workbook.xlsx.load(arrayBuffer);
      } else {
        await workbook.csv.read(Readable.from([buffer]));
      }
    } catch {
      throw new BadRequestException(
        `The uploaded ${extension.slice(1).toUpperCase()} file could not be read`,
      );
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('The uploaded file has no worksheet');
    }

    return worksheet;
  }

  private findHeaderRowNumber(worksheet: ExcelJS.Worksheet): number | null {
    let headerRowNumber: number | null = null;

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (headerRowNumber === null && this.rowHasData(row)) {
        headerRowNumber = rowNumber;
      }
    });

    return headerRowNumber;
  }

  private buildColumnMap(
    headerRow: ExcelJS.Row,
  ): Map<keyof BulkOrderItemDto, number> {
    const aliases = new Map<string, keyof BulkOrderItemDto>();
    for (const [field, names] of Object.entries(this.headerAliases)) {
      for (const name of names) {
        aliases.set(
          this.normalizeHeader(name),
          field as keyof BulkOrderItemDto,
        );
      }
    }

    const columnMap = new Map<keyof BulkOrderItemDto, number>();
    headerRow.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const field = aliases.get(this.normalizeHeader(this.cellToString(cell)));
      if (field && !columnMap.has(field)) {
        columnMap.set(field, columnNumber);
      }
    });

    return columnMap;
  }

  private validateRequiredHeaders(
    columnMap: Map<keyof BulkOrderItemDto, number>,
  ): void {
    const requiredHeaders: Array<keyof BulkOrderItemDto> = [
      'customer_name',
      'customer_phone',
      'customer_address',
    ];
    const missing = requiredHeaders.filter((field) => !columnMap.has(field));

    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing required column(s): ${missing.join(', ')}`,
      );
    }
  }

  private readMappedValues(
    row: ExcelJS.Row,
    columnMap: Map<keyof BulkOrderItemDto, number>,
  ): Partial<Record<keyof BulkOrderItemDto, string>> {
    const values: Partial<Record<keyof BulkOrderItemDto, string>> = {};

    for (const [field, columnNumber] of columnMap.entries()) {
      values[field] = this.cellToString(row.getCell(columnNumber)).trim();
    }

    return values;
  }

  private rowHasData(row: ExcelJS.Row): boolean {
    let hasData = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (this.cellToString(cell).trim()) {
        hasData = true;
      }
    });
    return hasData;
  }

  private cellToString(cell: ExcelJS.Cell): string {
    const value = cell.value;
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    return cell.text;
  }

  private normalizeHeader(value: string): string {
    return value
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private normalizePhone(value?: string): string {
    const digits = (value || '').replace(/\D/g, '');
    if (digits.length === 13 && digits.startsWith('880')) {
      return `0${digits.slice(3)}`;
    }
    if (digits.length === 10 && digits.startsWith('1')) {
      return `0${digits}`;
    }
    return digits;
  }

  private normalizeNumericRaw(value?: string): string {
    return (value || '')
      .trim()
      .replace(/,/g, '')
      .replace(/^(?:bdt|tk\.?|৳)\s*/i, '');
  }

  private normalizeBoolean(value: string | undefined, fallback: boolean) {
    const normalized = (value || '').trim().toLowerCase();
    if (['true', 'yes', 'y', '1', 'cod'].includes(normalized)) return 'TRUE';
    if (['false', 'no', 'n', '0', 'non-cod', 'non cod'].includes(normalized)) {
      return 'FALSE';
    }
    return fallback ? 'TRUE' : 'FALSE';
  }

  private normalizeParcelType(value?: string): string | undefined {
    const normalized = (value || '').trim().toLowerCase();
    const types: Record<string, string> = {
      parcel: '1',
      book: '2',
      document: '3',
      doc: '3',
    };
    return types[normalized] || value?.trim() || undefined;
  }

  private normalizeDeliveryType(value?: string): string | undefined {
    const normalized = (value || '').trim().toLowerCase();
    const types: Record<string, string> = {
      normal: '1',
      regular: '1',
      express: '2',
      'same day': '3',
      same_day: '3',
      sameday: '3',
    };
    return types[normalized] || value?.trim() || undefined;
  }

  private assignIfPresent<K extends keyof BulkOrderItemDto>(
    target: BulkOrderItemDto,
    field: K,
    value: BulkOrderItemDto[K] | undefined,
  ): void {
    if (value !== undefined && value !== '') {
      target[field] = value;
    }
  }
}
