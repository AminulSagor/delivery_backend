import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { PricingZone } from '../../common/enums/pricing-zone.enum';

/**
 * DTO for calculating weight charge
 * Used to get the weight charge for a specific weight and zone
 */
export class CalculateWeightChargeDto {
  @IsUUID('4', { message: 'Store ID must be a valid UUID (or omit to use global config)' })
  @IsOptional()
  store_id?: string;

  @IsEnum(PricingZone, { message: 'Zone must be one of: INSIDE_DHAKA, SUB_DHAKA, OUTSIDE_DHAKA' })
  zone: PricingZone;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Weight must be a number with max 2 decimal places' })
  @Min(0, { message: 'Weight cannot be negative' })
  weight_kg: number;
}

/**
 * Response for weight charge calculation
 */
export interface WeightChargeCalculationResult {
  zone: PricingZone;
  parcel_weight_kg: number;
  free_weight_kg: number;
  billable_weight_kg: number;
  weight_step_kg: number;
  charge_per_step: number;
  total_steps: number;
  weight_charge: number;
  breakdown: string; // Human-readable breakdown
}

