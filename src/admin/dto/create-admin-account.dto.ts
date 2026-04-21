import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';
import { AccountProviderType } from '../../common/enums/account-type.enum';
import { PartialType } from '@nestjs/mapped-types';

export class CreateAdminAccountDto {
  @IsNotEmpty()
  @IsString()
  account_name: string;

  @IsNotEmpty()
  @IsString()
  account_number: string;

  @IsNotEmpty()
  @IsString()
  account_holder_name: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  branch_name?: string;

  @IsOptional()
  @IsString()
  routing?: string;

  @IsNotEmpty()
  @IsEnum(AccountProviderType)
  provider_type: AccountProviderType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  opening_balance?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAdminAccountDto extends PartialType(CreateAdminAccountDto) {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
