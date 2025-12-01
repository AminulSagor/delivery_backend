import { IsOptional, IsEnum, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ParcelStatus } from '../../parcels/entities/parcel.entity';

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

export class DeliveryOutcomeQueryDto {
  @IsOptional()
  @IsEnum(ParcelStatus, { message: 'Invalid status. Must be one of: PARTIAL_DELIVERY, EXCHANGE, PAID_RETURN, RETURNED' })
  status?: ParcelStatus;

  @IsOptional()
  zone?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid merchant ID' })
  merchantId?: string;

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
