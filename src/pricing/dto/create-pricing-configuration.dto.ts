import {
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsUUID,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { PricingZone } from '../../common/enums/pricing-zone.enum';

export class CreatePricingConfigurationDto {
  @IsUUID('4', { message: 'Store ID must be a valid UUID' })
  store_id: string;

  @IsEnum(PricingZone, { message: 'Zone must be one of: INSIDE_DHAKA, SUB_DHAKA, OUTSIDE_DHAKA' })
  zone: PricingZone;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Delivery charge must be a number with max 2 decimal places' })
  @Min(0, { message: 'Delivery charge cannot be negative' })
  delivery_charge: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Weight charge must be a number with max 2 decimal places' })
  @Min(0, { message: 'Weight charge cannot be negative' })
  weight_charge_per_kg: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'COD percentage must be a number with max 2 decimal places' })
  @Min(0, { message: 'COD percentage cannot be negative' })
  @Max(100, { message: 'COD percentage cannot exceed 100' })
  cod_percentage: number; // e.g., 1.00 for 1%, 2.50 for 2.5%

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Discount percentage must be a number with max 2 decimal places' })
  @Min(0, { message: 'Discount percentage cannot be negative' })
  @Max(100, { message: 'Discount percentage cannot exceed 100' })
  @IsOptional()
  discount_percentage?: number; // e.g., 10.00 for 10% discount (optional)

  @IsDateString({}, { message: 'Start date must be a valid ISO date string (YYYY-MM-DD)' })
  @IsOptional()
  start_date?: string;

  @IsDateString({}, { message: 'End date must be a valid ISO date string (YYYY-MM-DD)' })
  @IsOptional()
  end_date?: string;
}
