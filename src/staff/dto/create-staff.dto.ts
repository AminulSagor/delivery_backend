import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  Matches,
  IsNumber,
  Min,
  MinLength,
} from 'class-validator';
import { BikeType } from '../entities/staff.entity';
import { StaffPosition } from '../../common/enums/staff-position.enum';

export class CreateStaffDto {
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

  // Position/Role
  @IsEnum(StaffPosition, { message: 'Invalid staff position' })
  position: StaffPosition;

  // Staff-specific fields
  @IsString()
  @IsOptional()
  photo?: string;

  @IsString()
  @Matches(/^01[0-9]{9}$/, {
    message: 'Secondary phone must be a valid Bangladesh number',
  })
  @IsOptional()
  secondary_phone?: string;

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

  // Financial - Only fixed salary
  @IsNumber()
  @Min(0, { message: 'Fixed salary cannot be negative' })
  fixed_salary: number;

  // Bank Information
  @IsString()
  @IsOptional()
  bank_name?: string;

  @IsString()
  @IsOptional()
  bank_account_number?: string;

  @IsString()
  @IsOptional()
  bank_branch?: string;

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

  // Hub assignment (required for Admin)
  @IsString()
  @IsNotEmpty()
  hub_id: string;
}
