import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsUUID, Min } from 'class-validator';

export class ProcessSalaryPaymentDto {
  @IsUUID()
  staff_id: string;

  @IsUUID()
  account_id: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  payment_amount: number;

  @IsIn(['bank_transfer', 'bkash', 'nagad', 'manual'])
  payment_method: 'bank_transfer' | 'bkash' | 'nagad' | 'manual';
}
