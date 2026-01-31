import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  IsArray,
} from 'class-validator';

export class CollectCodDto {
  @IsNotEmpty()
  @IsUUID()
  rider_id: string;

  @IsNotEmpty()
  @IsArray()
  @IsUUID('4', { each: true })
  parcel_ids: string[]; // List of parcels to settle

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  cash_received: number; // The manual "Counted Amount"

  @IsOptional()
  @IsNumber()
  discrepancy_amount?: number; // Optional: Manually specified mismatch (e.g., lost money)

  @IsOptional()
  @IsNumber()
  due_amount?: number; // Optional: Valid due/loan (collected < collectable)

  @IsOptional()
  notes?: string;
}
