import {
  IsString,
  IsEmail,
  IsOptional,
  IsInt,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

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
  @IsOptional()
  @MinLength(2)
  district?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  thana?: string;

  @IsString()
  @IsOptional()
  area?: string;

  @IsString()
  @IsOptional()
  @Matches(/^01[0-9]{9}$/, {
    message: 'Phone number must be valid BD format (01XXXXXXXXX)',
  })
  phone_number?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  facebook_page?: string;

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
