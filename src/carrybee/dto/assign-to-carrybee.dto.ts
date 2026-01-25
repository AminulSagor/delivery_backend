import {
  IsUUID,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsArray,
} from 'class-validator';

export class AssignToCarrybeeDto {
  @IsUUID()
  provider_id: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class AssignParcelToCarrybeeDto {
  @IsNotEmpty()
  @IsArray()
  @IsUUID('all', { each: true }) // Validates that every item in the array is a UUID
  parcel_ids: string[];

  @IsNotEmpty()
  @IsUUID()
  provider_id: string; // The ID of the Carrybee provider in your DB

  @IsOptional()
  @IsString()
  notes?: string;
}
