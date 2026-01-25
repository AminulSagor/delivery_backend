import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class BulkAcceptDto {
  @IsNotEmpty()
  @IsArray()
  @IsUUID('all', { each: true }) // Validates each item in the array is a UUID
  parcel_ids: string[];
}
