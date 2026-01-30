import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateStatementDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;
  // NOTE: Changing amount is dangerous in a ledger, logic will handle balance adjustment
}
