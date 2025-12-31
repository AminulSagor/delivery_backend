import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateTransferRecordDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01, { message: 'Transferred amount must be greater than 0' })
  transferred_amount: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  admin_bank_name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  admin_bank_account_number: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  admin_account_holder_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  transaction_reference_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

