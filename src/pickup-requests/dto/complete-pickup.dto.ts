import { IsInt, IsNotEmpty, Min, IsOptional, IsString } from 'class-validator';

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
}
