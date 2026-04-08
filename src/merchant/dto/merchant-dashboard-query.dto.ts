import { IsIn, IsOptional, Matches } from 'class-validator';

export class MerchantDashboardQueryDto {
  @IsOptional()
  @IsIn(['weekly', 'monthly'])
  performance_range?: 'weekly' | 'monthly';

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  lifetime_start_date?: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  lifetime_end_date?: string;
}
