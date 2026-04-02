import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class BulkReceiveParcelsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one parcel ID is required' })
  @IsUUID('4', { each: true, message: 'Each parcel ID must be a valid UUID' })
  parcel_ids: string[];
}
