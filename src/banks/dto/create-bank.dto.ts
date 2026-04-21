import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBankDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  short_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  district: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  branch_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  routing: string;

  // Optional fields (not in entity yet, but okay if you plan to add later)
  @IsString()
  @IsOptional()
  @MaxLength(500)
  logo_url?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  swift_code?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  display_order?: number;
}