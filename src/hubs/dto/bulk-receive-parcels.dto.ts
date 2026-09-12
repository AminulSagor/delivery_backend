import { Type } from 'class-transformer';
import {
  IsArray,
  IsUUID,
  ArrayMinSize,
  IsOptional,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';

export class ReceiveParcelWeightDto {
  @IsUUID('4', { message: 'Weight update parcel ID must be a valid UUID' })
  parcel_id: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Product weight must be a number' },
  )
  @Min(0, { message: 'Product weight must not be less than 0' })
  product_weight: number;
}

export class BulkReceiveParcelsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one parcel ID is required' })
  @IsUUID('4', { each: true, message: 'Each parcel ID must be a valid UUID' })
  parcel_ids: string[];

  /** Optional actual weights confirmed by the hub during receipt. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveParcelWeightDto)
  weight_updates?: ReceiveParcelWeightDto[];
}
