import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  Matches,
  IsInt,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

export class AdminCreateMerchantDto {
  // === USER FIELDS ===
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  full_name: string;

  @IsString()
  @Matches(/^01[0-9]{9}$/, {
    message: 'Phone must be a valid Bangladesh number (01XXXXXXXXX)',
  })
  phone: string;

  @IsString()
  @MinLength(4)
  password: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^01[0-9]{9}$/, {
    message: 'Secondary number must be a valid Bangladesh number (01XXXXXXXXX)',
  })
  secondary_number?: string;

  // === STORE FIELDS ===
  @IsString()
  @IsNotEmpty()
  business_name: string;

  @IsString()
  business_address: string;

  // === LOCATION FIELDS ===
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  district: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  thana: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  full_address?: string;

  // === CARRYBEE IDS ===
  @IsOptional()
  carrybee_city_id?: number;

  @IsOptional()
  carrybee_zone_id?: number;

  @IsOptional()
  carrybee_area_id?: number;
}
