import {
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { PricingZone } from '../../common/enums/pricing-zone.enum';

/**
 * DTO for updating pricing configuration
 * All fields are optional - only provided fields will be updated
 *
 * NOTE: free_weight_kg (0.5 kg) and charge_per_step (10/20 BDT) are FIXED
 */
export class UpdatePricingConfigurationDto {
  @IsEnum(PricingZone, {
    message: 'Zone must be one of: INSIDE_DHAKA, SUB_DHAKA, OUTSIDE_DHAKA',
  })
  @IsOptional()
  zone?: PricingZone;

  // ===== DELIVERY CHARGE =====
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Delivery charge must be a number with max 2 decimal places' },
  )
  @Min(0, { message: 'Delivery charge cannot be negative' })
  @IsOptional()
  delivery_charge?: number;

  // ===== WEIGHT STEP SIZE =====
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Weight step must be a number with max 2 decimal places' },
  )
  @Min(0.1, { message: 'Weight step must be at least 0.1 kg' })
  @IsOptional()
  weight_step_kg?: number;

  // ===== COD CHARGE =====
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'COD percentage must be a number with max 2 decimal places' },
  )
  @Min(0, { message: 'COD percentage cannot be negative' })
  @Max(100, { message: 'COD percentage cannot exceed 100' })
  @IsOptional()
  cod_percentage?: number;

  // ===== DISCOUNT =====
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message: 'Discount percentage must be a number with max 2 decimal places',
    },
  )
  @Min(0, { message: 'Discount percentage cannot be negative' })
  @Max(100, { message: 'Discount percentage cannot exceed 100' })
  @IsOptional()
  discount_percentage?: number;

  // ===== VALIDITY PERIOD =====
  @IsDateString({}, { message: 'Start date must be a valid ISO date string' })
  @IsOptional()
  start_date?: string;

  @IsDateString({}, { message: 'End date must be a valid ISO date string' })
  @IsOptional()
  end_date?: string;
}
