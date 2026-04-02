import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
  ValidateIf,
} from 'class-validator';

/**
 * Unified DTO for assigning parcels to a rider
 * Supports both single parcel and bulk parcel assignment
 *
 * Usage:
 * - Single: { rider_id: "...", parcel_id: "..." }
 * - Bulk:   { rider_id: "...", parcel_ids: ["...", "..."] }
 * - Both:   { rider_id: "...", parcel_id: "...", parcel_ids: ["...", "..."] } (parcel_ids takes priority)
 */
export class BulkAssignParcelsToRiderDto {
  @IsString()
  @IsNotEmpty()
  rider_id: string;

  /**
   * Single parcel ID (for single assignment)
   * Use this OR parcel_ids, not both
   */
  @ValidateIf((o) => !o.parcel_ids || o.parcel_ids.length === 0)
  @IsUUID('4', { message: 'parcel_id must be a valid UUID' })
  @IsOptional()
  parcel_id?: string;

  /**
   * Array of parcel IDs (for bulk assignment)
   * Takes priority over parcel_id if both are provided
   */
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each parcel ID must be a valid UUID' })
  @IsOptional()
  parcel_ids?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}
