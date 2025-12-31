import { IsOptional, IsEnum, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SettlementStatus } from '../../common/enums/settlement-status.enum';

export class SettlementQueryDto {
  @IsDateString({}, { message: 'Start date must be a valid ISO date string' })
  @IsOptional()
  start_date?: string;

  @IsDateString({}, { message: 'End date must be a valid ISO date string' })
  @IsOptional()
  end_date?: string;

  @IsEnum(SettlementStatus, {
    message: 'Status must be one of: PENDING, COMPLETED, PARTIAL',
  })
  @IsOptional()
  status?: SettlementStatus;

  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}

