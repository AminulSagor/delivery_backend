import { IsUUID, IsArray, ArrayNotEmpty, IsOptional, IsString } from 'class-validator';

export class TransferSelectedParcelsDto {
  /** Target rider to transfer parcels TO */
  @IsUUID('4')
  target_rider_id: string;

  /** Array of specific parcel IDs to transfer */
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  parcel_ids: string[];

  /** Optional notes for the transfer */
  @IsOptional()
  @IsString()
  notes?: string;
}
