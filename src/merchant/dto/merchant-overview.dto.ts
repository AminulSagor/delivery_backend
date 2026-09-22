import { IsIn, IsOptional, Matches } from 'class-validator';

export class MerchantOverviewQueryDto {
  @IsOptional()
  @IsIn(['last7d', 'month'])
  range?: 'last7d' | 'month';

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  start_date?: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  end_date?: string;
}
