import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
} from 'class-validator';

export class TransferParcelDto {
  @IsString()
  @IsNotEmpty()
  destination_hub_id: string;

  @IsString()
  @IsOptional()
  transfer_notes?: string;
}

export class BulkTransferDto {
  @IsNotEmpty()
  @IsArray()
  @IsUUID('all', { each: true }) // Validates each item in the array is a UUID
  parcel_ids: string[];

  @IsNotEmpty()
  @IsUUID()
  destination_hub_id: string;

  @IsOptional()
  @IsString()
  transfer_notes?: string;
}
