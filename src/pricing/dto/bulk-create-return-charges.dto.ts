import { Type } from 'class-transformer';
import {
  IsArray,
  ValidateNested,
  IsUUID,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { PricingZone } from '../../common/enums/pricing-zone.enum';
import { ReturnStatus } from '../entities/return-charge-configuration.entity';

export class StatusChargeDto {
  @IsEnum(ReturnStatus, {
    message: 'Return status must be one of: PARTIAL_DELIVERY, EXCHANGE, RETURNED, PAID_RETURN',
  })
  return_status: ReturnStatus;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Return delivery charge must be a number with max 2 decimal places' }
  )
  @Min(0, { message: 'Return delivery charge cannot be negative' })
  return_delivery_charge: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Return weight charge must be a number with max 2 decimal places' }
  )
  @Min(0, { message: 'Return weight charge cannot be negative' })
  return_weight_charge_per_kg: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Return COD percentage must be a number with max 2 decimal places' }
  )
  @Min(0, { message: 'Return COD percentage cannot be negative' })
  @Max(100, { message: 'Return COD percentage cannot exceed 100' })
  @IsOptional()
  return_cod_percentage?: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Discount percentage must be a number with max 2 decimal places' }
  )
  @Min(0, { message: 'Discount percentage cannot be negative' })
  @Max(100, { message: 'Discount percentage cannot exceed 100' })
  @IsOptional()
  discount_percentage?: number;
}

export class BulkCreateReturnChargesDto {
  @IsUUID('4', { message: 'Store ID must be a valid UUID' })
  store_id: string;

  @IsEnum(PricingZone, {
    message: 'Zone must be one of: INSIDE_DHAKA, SUB_DHAKA, OUTSIDE_DHAKA',
  })
  zone: PricingZone;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusChargeDto)
  status_charges: StatusChargeDto[];

  @IsDateString({}, { message: 'Start date must be a valid ISO date string (YYYY-MM-DD)' })
  @IsOptional()
  start_date?: string;

  @IsDateString({}, { message: 'End date must be a valid ISO date string (YYYY-MM-DD)' })
  @IsOptional()
  end_date?: string;
}

