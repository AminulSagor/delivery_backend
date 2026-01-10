import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { FinanceTransactionType } from '../../common/enums/finance-transaction-type.enum';

export class AdjustBalanceDto {
  @IsEnum(FinanceTransactionType)
  type: FinanceTransactionType;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class HoldBalanceDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReleaseHoldDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ProcessWithdrawalDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsUUID()
  payout_method_id?: string;

  @IsOptional()
  @IsString()
  payment_reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

