import {
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { PricingZone } from '../../common/enums/pricing-zone.enum';

export class UpdatePricingConfigurationDto {
  @IsEnum(PricingZone, { message: 'Zone must be one of: INSIDE_DHAKA, SUB_DHAKA, OUTSIDE_DHAKA' })
  @IsOptional()
  zone?: PricingZone;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Delivery charge must be a number with max 2 decimal places' })
  @Min(0, { message: 'Delivery charge cannot be negative' })
  @IsOptional()
  delivery_charge?: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Weight charge must be a number with max 2 decimal places' })
  @Min(0, { message: 'Weight charge cannot be negative' })
  @IsOptional()
  weight_charge_per_kg?: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'COD percentage must be a number with max 2 decimal places' })
  @Min(0, { message: 'COD percentage cannot be negative' })
  @Max(100, { message: 'COD percentage cannot exceed 100' })
  @IsOptional()
  cod_percentage?: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Discount percentage must be a number with max 2 decimal places' })
  @Min(0, { message: 'Discount percentage cannot be negative' })
  @Max(100, { message: 'Discount percentage cannot exceed 100' })
  @IsOptional()
  discount_percentage?: number;

  @IsDateString({}, { message: 'Start date must be a valid ISO date string' })
  @IsOptional()
  start_date?: string;

  @IsDateString({}, { message: 'End date must be a valid ISO date string' })
  @IsOptional()
  end_date?: string;
}

