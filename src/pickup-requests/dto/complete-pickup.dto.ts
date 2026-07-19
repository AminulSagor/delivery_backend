import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/**
 * DTO for rider to complete pickup with actual count
 * Rider specifies how many parcels they actually picked up
 */
export class CompletePickupDto {
  @IsInt()
  @IsNotEmpty({ message: 'Picked up count is required' })
  @Min(0, { message: 'Picked up count cannot be negative' })
  picked_up_count: number;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Required for exact per-parcel tracking when only part of a pickup is collected. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  parcel_ids?: string[];
}
