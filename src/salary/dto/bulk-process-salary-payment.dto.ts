import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { ProcessSalaryPaymentDto } from './process-salary-payment.dto';

export class BulkProcessSalaryPaymentDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProcessSalaryPaymentDto)
  payments: ProcessSalaryPaymentDto[];
}
