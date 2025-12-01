import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  Matches,
  IsNumber,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { BikeType } from '../entities/rider.entity';

export class CreateRiderDto {
  // User fields
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsString()
  @Matches(/^01[0-9]{9}$/, {
    message: 'Phone must be a valid Bangladesh number (01XXXXXXXXX)',
  })
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  // Rider-specific fields
  @IsString()
  @IsOptional()
  photo?: string;

  @IsString()
  @Matches(/^01[0-9]{9}$/, {
    message: 'Guardian phone must be a valid Bangladesh number',
  })
  guardian_mobile_no: string;

  @IsEnum(BikeType, { message: 'Invalid bike type' })
  bike_type: BikeType;

  @IsString()
  @IsNotEmpty()
  nid_number: string;

  @IsString()
  @IsOptional()
  license_no?: string;

  @IsString()
  @IsNotEmpty()
  present_address: string;

  @IsString()
  @IsNotEmpty()
  permanent_address: string;

  @IsNumber()
  @Min(0, { message: 'Fixed salary cannot be negative' })
  fixed_salary: number;

  @IsNumber()
  @Min(0, { message: 'Commission percentage cannot be negative' })
  @Max(100, { message: 'Commission percentage cannot exceed 100' })
  commission_percentage: number;

  // Documents
  @IsString()
  @IsNotEmpty()
  nid_front_photo: string;

  @IsString()
  @IsNotEmpty()
  nid_back_photo: string;

  @IsString()
  @IsOptional()
  license_front_photo?: string;

  @IsString()
  @IsOptional()
  license_back_photo?: string;

  @IsString()
  @IsNotEmpty()
  parent_nid_front_photo: string;

  @IsString()
  @IsNotEmpty()
  parent_nid_back_photo: string;

  // Hub assignment (only for Admin)
  @IsString()
  @IsOptional()
  hub_id?: string;
}
