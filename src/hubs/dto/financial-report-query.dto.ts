import { IsOptional, IsEnum, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum ReportPeriod {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  ALL_TIME = 'ALL_TIME',
}

export class FinancialReportQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ReportPeriod)
  period?: ReportPeriod = ReportPeriod.MONTHLY;

  @IsOptional()
  @IsString()
  type?: 'SETTLEMENT' | 'EXPENSE' | 'TRANSFER'; // Filter by activity type
}
