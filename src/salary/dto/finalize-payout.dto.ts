import { IsEnum, IsOptional, IsString, IsISO8601 } from 'class-validator';
import { PayoutTransactionStatus } from '../../common/enums/payout-transaction-status.enum';

export class FinalizePayoutDto {
  @IsEnum(PayoutTransactionStatus)
  status: PayoutTransactionStatus;

  @IsOptional()
  @IsString()
  failure_reason?: string;

  @IsOptional()
  @IsISO8601()
  processed_at?: string;
}
