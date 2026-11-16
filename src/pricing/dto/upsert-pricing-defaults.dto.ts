import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PricingZone } from '../../common/enums/pricing-zone.enum';
import { ReturnStatus } from '../entities/return-charge-configuration.entity';

export class DefaultDeliveryPricingDto {
  @IsEnum(PricingZone)
  zone: PricingZone;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  delivery_charge: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  weight_step_kg: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  cod_percentage: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discount_percentage: number;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;
}

export class DefaultReturnPricingDto {
  @IsEnum(PricingZone)
  zone: PricingZone;

  @IsEnum(ReturnStatus)
  return_status: ReturnStatus;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  return_delivery_charge: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  return_weight_charge_per_kg: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  return_cod_percentage: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discount_percentage: number;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;
}

export class UpsertPricingDefaultsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => DefaultDeliveryPricingDto)
  delivery_charges: DefaultDeliveryPricingDto[];

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => DefaultReturnPricingDto)
  return_charges: DefaultReturnPricingDto[];
}
