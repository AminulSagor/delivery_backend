import { PartialType } from '@nestjs/mapped-types';
import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateThirdPartyProviderDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  // Ensure code is URL-safe and standard (e.g., PATHAO, REDX)
  @Matches(/^[A-Z0-9_]+$/, {
    message:
      'Provider code must be uppercase letters, numbers, and underscores only',
  })
  provider_code: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  provider_name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateThirdPartyProviderDto extends PartialType(
  CreateThirdPartyProviderDto,
) {}
