import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PayInvoiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  payment_reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

