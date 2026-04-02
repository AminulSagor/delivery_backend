import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { PricingZone } from '../../common/enums/pricing-zone.enum';

/**
 * DTO for creating pricing configuration per store per zone
 *
 * WEIGHT CHARGE RULES (FIXED VALUES):
 * - First 0.5 kg is ALWAYS FREE (fixed)
 * - Charge per step: 10 BDT for INSIDE_DHAKA, 20 BDT for SUB_DHAKA & OUTSIDE_DHAKA (fixed)
 * - Weight step size is configurable per zone
 *
 * DEFAULT WEIGHT STEP BY ZONE:
 * - INSIDE_DHAKA: 0.5 kg per step
 * - SUB_DHAKA: 2.0 kg per step
 * - OUTSIDE_DHAKA: 1.0 kg per step
 */
export class CreatePricingConfigurationDto {
  @IsUUID('4', { message: 'Store ID must be a valid UUID' })
  store_id: string;

  @IsEnum(PricingZone, {
    message: 'Zone must be one of: INSIDE_DHAKA, SUB_DHAKA, OUTSIDE_DHAKA',
  })
  zone: PricingZone;

  // ===== DELIVERY CHARGE =====
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Delivery charge must be a number with max 2 decimal places' },
  )
  @Min(0, { message: 'Delivery charge cannot be negative' })
  delivery_charge: number;

  // ===== WEIGHT STEP SIZE =====
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Weight step must be a number with max 2 decimal places' },
  )
  @Min(0.1, { message: 'Weight step must be at least 0.1 kg' })
  weight_step_kg: number; // e.g., 0.5 for INSIDE_DHAKA, 2.0 for SUB_DHAKA, 1.0 for OUTSIDE_DHAKA

  // ===== COD CHARGE =====
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'COD percentage must be a number with max 2 decimal places' },
  )
  @Min(0, { message: 'COD percentage cannot be negative' })
  @Max(100, { message: 'COD percentage cannot exceed 100' })
  cod_percentage: number; // e.g., 1.00 for 1%, 2.50 for 2.5%

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
  discount_percentage?: number; // e.g., 10.00 for 10% discount (optional)

  // ===== VALIDITY PERIOD =====
  @IsDateString(
    {},
    { message: 'Start date must be a valid ISO date string (YYYY-MM-DD)' },
  )
  @IsOptional()
  start_date?: string;

  @IsDateString(
    {},
    { message: 'End date must be a valid ISO date string (YYYY-MM-DD)' },
  )
  @IsOptional()
  end_date?: string;
}
