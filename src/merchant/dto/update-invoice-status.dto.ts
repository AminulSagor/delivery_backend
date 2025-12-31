import { IsEnum } from 'class-validator';
import { InvoiceStatus } from '../entities/merchant-invoice.entity';

export class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatus)
  invoice_status: InvoiceStatus;
}

