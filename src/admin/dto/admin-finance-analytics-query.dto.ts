import { IsDateString, IsOptional } from 'class-validator';

export class AdminFinanceAnalyticsQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'startDate must be a valid ISO date string' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'endDate must be a valid ISO date string' })
  endDate?: string;
}
