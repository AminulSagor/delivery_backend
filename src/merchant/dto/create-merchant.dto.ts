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

export class MerchantSignupDto {
  // === USER FIELDS ===
  @IsString()
  @MinLength(2)
  full_name: string;

  @IsString()
  @Matches(/^\+8801[3-9]\d{8}$/, {
    message: 'Phone must be a valid Bangladeshi number starting with +8801',
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
  @Matches(/^\+8801[3-9]\d{8}$/, {
    message:
      'Secondary number must be a valid Bangladeshi number starting with +8801',
  })
  secondary_number?: string;

  // === STORE FIELDS ===
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  business_name: string;

  @IsString()
  @IsNotEmpty()
  business_address: string;

  // === LOCATION FIELDS (Auto-filled from address suggestion) ===
  @IsString()
  @MinLength(2)
  district: string;

  @IsString()
  @MinLength(2)
  thana: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  full_address?: string;

  // === CARRYBEE IDS (From address suggestion API) ===
  @IsInt()
  @IsNotEmpty()
  carrybee_city_id: number;

  @IsInt()
  @IsNotEmpty()
  carrybee_zone_id: number;

  @IsInt()
  @IsNotEmpty()
  carrybee_area_id: number;
}
