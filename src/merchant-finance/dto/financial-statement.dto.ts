import { IsIn, IsOptional, Matches } from 'class-validator';

export class MerchantEarningsGraphQueryDto {
  @IsOptional()
  @IsIn(['weekly', 'monthly'])
  range?: 'weekly' | 'monthly' = 'weekly';

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be in YYYY-MM format',
  })
  month?: string;
}

export interface MerchantFinancialStatement {
  merchant_available_balance: {
    total: number;
  };
  pending_payment: {
    total: number;
    month: string;
  };
  last_payout: {
    total: number;
    last_payout: string | null;
  };
  earning_this_month: {
    total: number;
    month: string;
  };
  lifetime_earning: {
    total: number;
  };
}

export interface MerchantEarningsGraphPoint {
  label: string;
  date: string;
  earnings: number;
}

export interface MerchantEarningsGraph {
  range: 'weekly' | 'monthly';
  month: string | null;
  month_label: string | null;
  points: MerchantEarningsGraphPoint[];
  summary: {
    peak_day: string | null;
    peak_day_earnings: number;
    total_earnings: number;
    daily_average: number;
  };
}
