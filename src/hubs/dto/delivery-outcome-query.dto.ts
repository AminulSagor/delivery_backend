import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsString,
  IsNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ParcelStatus } from '../../parcels/entities/parcel.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { DeliveryType } from '../../common/enums/delivery-type.enum';

/**
 * Delivery outcome statuses for returns/exchanges
 * These parcels need to be processed (return to merchant or handle exchange)
 *
 * Note: DELIVERY_RESCHEDULED has separate endpoint (needs re-delivery, not return)
 */
export const DELIVERY_OUTCOME_STATUSES = [
  ParcelStatus.PARTIAL_DELIVERY,
  ParcelStatus.EXCHANGE,
  ParcelStatus.PAID_RETURN,
  ParcelStatus.RETURNED,
] as const;

export class DeliveryOutcomeQueryDto extends PaginationDto {
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

  @IsOptional()
  @IsString({ message: 'Sort by must be a string' })
  sortBy?: string = 'updated_at';

  @IsOptional()
  @IsEnum(ParcelStatus, {
    message:
      'Invalid status. Must be one of: PARTIAL_DELIVERY, EXCHANGE, PAID_RETURN, RETURNED',
  })
  status?: ParcelStatus;

  @IsOptional()
  zone?: string;

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
}
