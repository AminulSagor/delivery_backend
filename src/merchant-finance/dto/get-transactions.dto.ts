import { IsEnum, IsOptional, IsNumber, IsString, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  FinanceTransactionType,
  FinanceReferenceType,
} from '../../common/enums/finance-transaction-type.enum';

export class GetTransactionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(FinanceTransactionType)
  transaction_type?: FinanceTransactionType;

  @IsOptional()
  @IsEnum(FinanceReferenceType)
  reference_type?: FinanceReferenceType;

  @IsOptional()
  @IsDateString()
  from_date?: string;

  @IsOptional()
  @IsDateString()
  to_date?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sort_by?: 'created_at' | 'amount' = 'created_at';

  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC' = 'DESC';
}

export class GetAllMerchantsFinanceQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Boolean)
  has_balance?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  has_pending?: boolean;

  @IsOptional()
  @IsString()
  sort_by?: 'current_balance' | 'total_earned' | 'created_at' = 'current_balance';

  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC' = 'DESC';
}

