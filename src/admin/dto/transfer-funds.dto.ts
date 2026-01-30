import { IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator';

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

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  reference_id: string;
}
