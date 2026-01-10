import { IsOptional, IsString, IsUUID, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ParcelStatus } from '../../parcels/entities/parcel.entity';
import { InvoiceStatus } from '../entities/merchant-invoice.entity';

export class InvoiceDetailsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(ParcelStatus)
  order_status?: ParcelStatus;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  invoice_status?: InvoiceStatus;

  @IsOptional()
  @IsUUID()
  store_id?: string;

  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsString()
  to_date?: string;

  @IsOptional()
  @IsString()
  sort_by?: 'order_date' | 'receivable_amount' = 'order_date';

  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC' = 'DESC';
}













