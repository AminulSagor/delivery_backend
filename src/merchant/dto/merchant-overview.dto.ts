import { IsIn, IsOptional, Matches } from 'class-validator';

export class MerchantOverviewQueryDto {
  @IsOptional()
  @IsIn(['last7d', 'month'])
  range?: 'last7d' | 'month';

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;
}
