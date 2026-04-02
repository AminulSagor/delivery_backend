import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsUUID,
  ArrayMinSize,
  IsOptional,
} from 'class-validator';

/**
 * DTO for Hub Manager to bulk assign pickup requests to rider
 */
export class BulkAssignPickupToRiderDto {
  @IsString()
  @IsNotEmpty({ message: 'Rider ID is required' })
  @IsUUID('4', { message: 'Rider ID must be a valid UUID' })
  rider_id: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one pickup request ID is required' })
  @IsUUID('4', { each: true, message: 'Each pickup ID must be a valid UUID' })
  pickup_ids: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
