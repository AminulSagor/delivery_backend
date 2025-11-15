import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsBoolean,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

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
  @IsNotEmpty()
  @Matches(/^01[0-9]{9}$/, {
    message: 'Phone number must be valid BD format (01XXXXXXXXX)',
  })
  phone_number: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  facebook_page?: string;

  @IsBoolean()
  @IsOptional()
  is_default?: boolean;
}
