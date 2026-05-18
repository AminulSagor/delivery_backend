import {
  IsString,
  IsEmail,
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsBoolean,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const sanitizeOptionalText = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  business_name: string;

  @IsString()
  @IsNotEmpty()
  business_address: string;

  @IsString()
  @Transform(sanitizeOptionalText)
  @IsOptional()
  @MinLength(2)
  district?: string;

  @IsString()
  @Transform(sanitizeOptionalText)
  @IsOptional()
  @MinLength(2)
  thana?: string;

  @IsString()
  @Transform(sanitizeOptionalText)
  @IsOptional()
  area?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^01[0-9]{9}$/, {
    message: 'Phone number must be valid BD format (01XXXXXXXXX)',
  })
  phone_number: string;

  @Transform(sanitizeOptionalText)
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @Transform(sanitizeOptionalText)
  @IsOptional()
  @MaxLength(255)
  facebook_page?: string;

  @IsString()
  @Transform(sanitizeOptionalText)
  @IsOptional()
  @MaxLength(255)
  fb?: string;

  @IsBoolean()
  @IsOptional()
  is_default?: boolean;
}
