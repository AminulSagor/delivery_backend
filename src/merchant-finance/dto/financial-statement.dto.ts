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
  available_balance: number;
  pending_payments: number;
  month: string;
  last_payout: {
    amount: number | null;
    paid_at: Date | null;
  };
  earning_this_month: number;
  lifetime_earnings: number;
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
