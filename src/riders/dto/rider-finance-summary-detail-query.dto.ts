import { IsEnum, IsOptional } from 'class-validator';
import { RiderFinanceSummaryMetric } from './rider-finance-summary-breakdown-query.dto';

export class RiderFinanceSummaryDetailQueryDto {
  @IsOptional()
  @IsEnum(RiderFinanceSummaryMetric, {
    message:
      'Invalid metric. Use: delivered, partially_delivered, return, paid_return, pickup, exchanged, return_to_merchant',
  })
  metric?: RiderFinanceSummaryMetric;
}
