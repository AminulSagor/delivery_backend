import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ParcelStatus } from '../../parcels/entities/parcel.entity';
import { InvoiceStatus } from '../entities/merchant-invoice.entity';

export class InvoiceDetailsFlexQueryDto {
  @IsOptional()
  @IsUUID()
  invoice_id?: string;

  @IsOptional()
  @IsUUID()
  merchant_id?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  invoice_status?: InvoiceStatus;

  @IsOptional()
  @IsEnum(ParcelStatus)
  order_status?: ParcelStatus;

  @IsOptional()
  @IsUUID()
  store_id?: string;

  @IsOptional()
  @IsDateString()
  from_date?: string;

  @IsOptional()
  @IsDateString()
  to_date?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['order_date', 'receivable_amount'])
  sort_by?: 'order_date' | 'receivable_amount' = 'order_date';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sort_order?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
