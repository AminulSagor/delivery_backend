import { IsNumber, IsIn, IsOptional, IsString, Min, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ParcelStatus, RIDER_DELIVERY_STATUSES } from '../../parcels/entities/parcel.entity';

/**
 * DTO for initiating delivery status update
 * 
 * Rider selects a status and provides collected amount.
 * For certain statuses (Delivery Rescheduled, Return, Paid Return), reason is always required.
 */
export class InitiateDeliveryDto {
  /**
   * The delivery status the rider wants to set
   * Valid values: DELIVERED, PARTIAL_DELIVERY, EXCHANGE, DELIVERY_RESCHEDULED, PAID_RETURN, RETURNED
   */
  @IsIn(RIDER_DELIVERY_STATUSES, {
    message: 'Invalid status. Must be one of: DELIVERED, PARTIAL_DELIVERY, EXCHANGE, DELIVERY_RESCHEDULED, PAID_RETURN, RETURNED',
  })
  selected_status: ParcelStatus;

  /**
   * Amount collected from customer (can be 0 for already paid parcels)
   */
  @IsNumber({}, { message: 'Collected amount must be a number' })
  @Min(0, { message: 'Collected amount cannot be negative' })
  @Type(() => Number)
  collected_amount: number;

  /**
   * Reason for the delivery outcome
   * Required when:
   * - Collected amount differs from expected amount
   * - Status is DELIVERY_RESCHEDULED, PAID_RETURN, or RETURNED
   */
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Reason must be at least 10 characters' })
  @MaxLength(500, { message: 'Reason must not exceed 500 characters' })
  reason?: string;
}
