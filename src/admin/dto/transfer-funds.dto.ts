import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class TransferFundsDto {
  @IsNotEmpty()
  @IsUUID()
  from_account_id: string;

  @IsNotEmpty()
  @IsUUID()
  to_account_id: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  reference_id?: string;
}
