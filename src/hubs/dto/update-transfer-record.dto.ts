import {
  IsOptional,
  IsNumber,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class UpdateTransferRecordDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01, { message: 'Transferred amount must be greater than 0' })
  transferred_amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  admin_bank_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  admin_bank_account_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  admin_account_holder_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  transaction_reference_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

