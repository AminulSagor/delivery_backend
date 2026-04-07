import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum RiderFinanceSummaryMetric {
  DELIVERED = 'delivered',
  PARTIALLY_DELIVERED = 'partially_delivered',
  RETURN = 'return',
  PAID_RETURN = 'paid_return',
  PICKUP = 'pickup',
  EXCHANGED = 'exchanged',
  RETURN_TO_MERCHANT = 'return_to_merchant',
}

export class RiderFinanceSummaryBreakdownQueryDto {
  @IsEnum(RiderFinanceSummaryMetric, {
    message:
      'Invalid metric. Use: delivered, partially_delivered, return, paid_return, pickup, exchanged, return_to_merchant',
  })
  metric!: RiderFinanceSummaryMetric;

  @IsOptional()
  @IsDateString({}, { message: 'startDate must be a valid ISO date string' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'endDate must be a valid ISO date string' })
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  limit?: number = 20;
}
