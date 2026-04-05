import {
  IsString,
  IsEmail,
  IsOptional,
  IsInt,
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

export class UpdateStoreDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(255)
  business_name?: string;

  @IsString()
  @IsOptional()
  business_address?: string;

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
  @IsOptional()
  @Matches(/^01[0-9]{9}$/, {
    message: 'Phone number must be valid BD format (01XXXXXXXXX)',
  })
  phone_number?: string;

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

  @IsInt()
  @IsOptional()
  carrybee_city_id?: number;

  @IsInt()
  @IsOptional()
  carrybee_zone_id?: number;

  @IsInt()
  @IsOptional()
  carrybee_area_id?: number;
}
