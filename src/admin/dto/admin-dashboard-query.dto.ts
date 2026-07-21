import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

const DATE_ONLY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export enum AdminDashboardFlowRange {
  TODAY = 'today',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
}

export class AdminDashboardOverviewQueryDto {
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'date must use YYYY-MM-DD format',
  })
  date?: string;
}

export class AdminDashboardFlowQueryDto extends AdminDashboardOverviewQueryDto {
  @IsOptional()
  @IsUUID()
  hub_id?: string;

  @IsOptional()
  @IsEnum(AdminDashboardFlowRange)
  range?: AdminDashboardFlowRange = AdminDashboardFlowRange.TODAY;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'start_date must use YYYY-MM-DD format',
  })
  start_date?: string;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'end_date must use YYYY-MM-DD format',
  })
  end_date?: string;
}

export class AdminDashboardLifetimeQueryDto {
  @IsOptional()
  @IsUUID()
  hub_id?: string;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'start_date must use YYYY-MM-DD format',
  })
  start_date?: string;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'end_date must use YYYY-MM-DD format',
  })
  end_date?: string;
}

export class AdminDashboardEarningTrendsQueryDto {
  @IsOptional()
  @IsUUID()
  hub_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  start_year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  end_year?: number;
}
