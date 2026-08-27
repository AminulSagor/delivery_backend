import { Type } from 'class-transformer';

import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsIn,
  IsString,
  IsNumber,
  IsDateString,
} from 'class-validator';

import { PaginationDto } from '../../common/dto/pagination.dto';
import { ParcelStatus, PaymentStatus } from '../entities/parcel.entity';
import { DeliveryType } from '../../common/enums/delivery-type.enum';

export type ParcelStatusQuery = ParcelStatus | 'ACTIVE';

export class ParcelQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn([...Object.values(ParcelStatus), 'ACTIVE'], {
    message: 'Invalid parcel status. Use a valid status or ACTIVE',
  })
  status?: ParcelStatusQuery;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Days must be an integer' })
  @Min(1, { message: 'Days must be at least 1' })
  @Max(365, { message: 'Days cannot exceed 365' })
  days?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid start date' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid end date' })
  endDate?: string;

  @IsOptional()
  @IsEnum(PaymentStatus, { message: 'Invalid payment status' })
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid store ID' })
  storeId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid merchant ID' })
  merchantId?: string;

  @IsOptional()
  @IsString({ message: 'Customer name must be a string' })
  customerName?: string;

  @IsOptional()
  @IsString({ message: 'Customer phone must be a string' })
  customerPhone?: string;

  @IsOptional()
  @IsString({ message: 'Merchant name must be a string' })
  merchantName?: string;

  @IsOptional()
  @IsString({ message: 'Area must be a string' })
  area?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Minimum amount must be a number' })
  @Min(0, { message: 'Minimum amount cannot be negative' })
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Maximum amount must be a number' })
  @Min(0, { message: 'Maximum amount cannot be negative' })
  maxAmount?: number;

  @IsOptional()
  @IsEnum(DeliveryType, { message: 'Invalid delivery type' })
  deliveryType?: DeliveryType;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid hub ID' })
  hubId?: string;
}
