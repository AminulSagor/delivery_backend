import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MonthlySalaryModifiersDto,
  SalaryIncrementModifiersDto,
} from './salary-modifiers.dto';

export class GenerateSalaryDto {
  @IsUUID()
  staff_id: string;

  @ValidateNested()
  @Type(() => SalaryIncrementModifiersDto)
  salary_increment_modifiers: SalaryIncrementModifiersDto;

  @ValidateNested()
  @Type(() => MonthlySalaryModifiersDto)
  monthly_salary_modifiers: MonthlySalaryModifiersDto;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  final_payment_amount?: number;
}
