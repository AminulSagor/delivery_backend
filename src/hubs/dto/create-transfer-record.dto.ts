import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateTransferRecordDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  transferred_amount: number;

  @IsNotEmpty()
  @IsUUID()
  admin_account_id: string;

  @IsOptional()
  @IsString()
  admin_account_name?: string;

  @IsOptional()
  @IsString()
  admin_account_number?: string;

  @IsOptional()
  @IsString()
  admin_account_holder_name?: string;

  @IsNotEmpty()
  @IsString()
  transaction_reference_id: string;

  @IsNotEmpty()
  @IsString()
  proof_file_url: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
