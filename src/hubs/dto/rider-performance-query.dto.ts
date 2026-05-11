import {
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  IsEnum,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PerformancePeriod {
  TODAY = 'today',
  THIS_WEEK = 'this_week',
  LAST_WEEK = 'last_week',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  LAST_3_MONTHS = 'last_3_months',
  LAST_6_MONTHS = 'last_6_months',
  THIS_YEAR = 'this_year',
  ALL_TIME = 'all_time',
}

export class RiderPerformanceQueryDto {
  /** Filter by specific hub ID (Admin only) */
  @IsOptional()
  @IsUUID()
  hub_id?: string;

  /** Search by rider name or phone */
  @IsOptional()
  @IsString()
  search?: string;

  /** Filter by specific rider ID */
  @IsOptional()
  @IsUUID()
  riderId?: string;

  /** Preset period filter (overrides startDate/endDate if provided) */
  @IsOptional()
  @IsEnum(PerformancePeriod)
  period?: PerformancePeriod;

  /** Custom start date (ISO format) */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** Custom end date (ISO format) */
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
