import { IsUUID, IsArray, ArrayMinSize, IsOptional } from 'class-validator';

export class GenerateInvoiceDto {
  @IsOptional()
  @IsUUID()
  merchant_id?: string; // Optional - auto-detected from parcels

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one parcel must be included' })
  @IsUUID('4', { each: true })
  parcel_ids: string[];
}

