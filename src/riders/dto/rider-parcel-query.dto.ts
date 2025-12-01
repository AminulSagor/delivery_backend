import { IsOptional, IsEnum } from 'class-validator';
import { ParcelStatus } from '../../parcels/entities/parcel.entity';

/**
 * Rider App Sections:
 * 
 * 1. PICKUP Section (uses /riders/parcels/my-deliveries)
 *    - pending: ASSIGNED_TO_RIDER (assigned, needs to pick from hub)
 *    - completed: (moves to Delivery section after pickup)
 * 
 * 2. DELIVERY Section (uses /riders/parcels/my-deliveries)
 *    - pending: OUT_FOR_DELIVERY (rider has parcel, delivering)
 *    - completed: DELIVERED
 * 
 * 3. RETURN Section (uses /riders/parcels/my-deliveries)
 *    - pending: FAILED_DELIVERY (failed, needs to return to hub)
 *    - completed: RETURNED_TO_HUB
 */

export enum RiderDeliveryFilter {
  // Pickup section (parcel pickup from hub)
  PICKUP_PENDING = 'pickup_pending',           // ASSIGNED_TO_RIDER (waiting to pick from hub)
  
  // Delivery section
  DELIVERY_PENDING = 'delivery_pending',       // OUT_FOR_DELIVERY (actively delivering)
  DELIVERY_COMPLETED = 'delivery_completed',   // DELIVERED
  
  // Return section  
  RETURN_PENDING = 'return_pending',           // FAILED_DELIVERY (waiting to return)
  RETURN_COMPLETED = 'return_completed',       // RETURNED_TO_HUB
  
  // All
  ALL = 'all',
}

export class RiderParcelQueryDto {
  @IsOptional()
  @IsEnum(ParcelStatus, { message: 'Invalid parcel status' })
  status?: ParcelStatus;

  @IsOptional()
  @IsEnum(RiderDeliveryFilter, { 
    message: 'Invalid filter. Use: pickup_pending, delivery_pending, delivery_completed, return_pending, return_completed, all' 
  })
  filter?: RiderDeliveryFilter;
}