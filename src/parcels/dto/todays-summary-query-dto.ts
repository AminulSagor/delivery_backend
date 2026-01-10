import { IsOptional, IsDateString } from 'class-validator';

export class TodaySummaryQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string; // Optional: defaults to today, format: YYYY-MM-DD
}
