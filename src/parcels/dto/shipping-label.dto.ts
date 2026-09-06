import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';

export enum ShippingLabelLayout {
  A4 = 'A4',
  THERMAL = 'THERMAL',
}

export class ShippingLabelQueryDto {
  @IsOptional()
  @Transform(({ value }) => String(value).toUpperCase())
  @IsEnum(ShippingLabelLayout)
  layout?: ShippingLabelLayout;
}

export class BulkShippingLabelDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  parcel_ids: string[];

  @IsOptional()
  @Transform(({ value }) => String(value).toUpperCase())
  @IsEnum(ShippingLabelLayout)
  layout?: ShippingLabelLayout;
}
