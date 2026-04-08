import { IsIn, IsOptional, Matches } from 'class-validator';

export class MerchantDeliveryPerformanceQueryDto {
  @IsOptional()
  @IsIn(['weekly', 'monthly'])
  performance_range?: 'weekly' | 'monthly';

  @IsOptional()
  @Matches(/^(\d{4}-(0[1-9]|1[0-2])|[A-Za-z]+)$/)
  month?: string;
}
