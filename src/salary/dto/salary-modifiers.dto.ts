import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class SalaryIncrementModifiersDto {
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  increment?: number = 0;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  commitment_increment?: number = 0;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  pickup_increment?: number = 0;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  eid_bonus_per?: number = 0;
}

export class MonthlySalaryModifiersDto {
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  attendance?: number = 0;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  delivery?: number = 0;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  cancel?: number = 0;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  pickup?: number = 0;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  overtime?: number = 0;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  advance_acceptance?: number = 0;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  loan?: number = 0;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  previous_month?: number = 0;
}
