import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ParcelStatus } from '../../parcels/entities/parcel.entity';

const DATE_ONLY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export enum HubDashboardFlowRange {
  TODAY = 'today',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
}

export enum HubDashboardRiderStatus {
  ALL = 'all',
  ON_DUTY = 'on_duty',
  BREAK = 'break',
  LEAVE = 'leave',
}

export class HubDashboardDateQueryDto {
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'date must use YYYY-MM-DD format',
  })
  date?: string;
}

export class HubDashboardOverviewQueryDto extends HubDashboardDateQueryDto {
  @IsOptional()
  @IsEnum(HubDashboardFlowRange)
  flow_range?: HubDashboardFlowRange = HubDashboardFlowRange.TODAY;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  rider_limit?: number = 5;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  ongoing_limit?: number = 6;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'lifetime_start_date must use YYYY-MM-DD format',
  })
  lifetime_start_date?: string;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'lifetime_end_date must use YYYY-MM-DD format',
  })
  lifetime_end_date?: string;
}

export class HubDashboardFlowQueryDto extends HubDashboardDateQueryDto {
  @IsOptional()
  @IsEnum(HubDashboardFlowRange)
  range?: HubDashboardFlowRange = HubDashboardFlowRange.TODAY;
}

export class HubDashboardRiderQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(HubDashboardRiderStatus)
  status?: HubDashboardRiderStatus = HubDashboardRiderStatus.ALL;
}

export class HubDashboardOngoingQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ParcelStatus)
  status?: ParcelStatus;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'date must use YYYY-MM-DD format',
  })
  date?: string;
}

export class HubDashboardLifetimeQueryDto {
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
