import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import {
  FinanceTransactionType,
  FinanceReferenceType,
} from '../../common/enums/finance-transaction-type.enum';

export class CreateTransactionDto {
  @IsUUID()
  merchant_id: string;

  @IsEnum(FinanceTransactionType)
  transaction_type: FinanceTransactionType;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(FinanceReferenceType)
  reference_type: FinanceReferenceType;

  @IsOptional()
  @IsUUID()
  reference_id?: string;

  @IsOptional()
  @IsString()
  reference_code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  cod_amount?: number;

  @IsOptional()
  @IsNumber()
  delivery_charge?: number;

  @IsOptional()
  @IsNumber()
  return_charge?: number;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class RecordParcelTransactionDto {
  @IsUUID()
  parcel_id: string;

  @IsString()
  tracking_number: string;

  @IsString()
  parcel_status: string;

  @IsNumber()
  cod_collected: number;

  @IsNumber()
  delivery_charge: number;

  @IsNumber()
  return_charge: number;

  @IsNumber()
  net_payable: number;

  @IsOptional()
  @IsString()
  description?: string;
}

