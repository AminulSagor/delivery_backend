import { IsString, IsEmail, IsOptional, MinLength, Matches } from 'class-validator';

export class MerchantSignupDto {
  @IsString()
  @MinLength(2)
  full_name: string;

  @IsString()
  @Matches(/^\+8801[3-9]\d{8}$/, {
    message: 'Phone must be a valid Bangladeshi number starting with +8801',
  })
  phone: string;

  @IsString()
  @MinLength(2)
  thana: string;

  @IsString()
  @MinLength(2)
  district: string;

  @IsOptional()
  @IsString()
  full_address?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+8801[3-9]\d{8}$/, {
    message: 'Secondary number must be a valid Bangladeshi number starting with +8801',
  })
  secondary_number?: string;

  @IsString()
  @MinLength(4)
  password: string;
}
