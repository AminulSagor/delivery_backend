import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsUUID, 
  IsEmail, 
  MinLength, 
  MaxLength,
  Matches,
  IsAlphanumeric
} from 'class-validator';

export class CreateHubDto {
  @IsOptional()
  @IsString({ message: 'Hub code must be a string' })
  @MaxLength(50, { message: 'Hub code cannot exceed 50 characters' })
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Hub code must contain only uppercase letters, numbers, hyphens, and underscores' })
  hub_code?: string; // Now optional - will be auto-generated if not provided

  @IsString({ message: 'Branch name must be a string' })
  @IsNotEmpty({ message: 'Branch name is required' })
  @MaxLength(255, { message: 'Branch name cannot exceed 255 characters' })
  branch_name: string;

  @IsString({ message: 'Area must be a string' })
  @IsNotEmpty({ message: 'Area is required' })
  @MaxLength(255, { message: 'Area cannot exceed 255 characters' })
  area: string;

  @IsString({ message: 'Address must be a string' })
  @IsNotEmpty({ message: 'Address is required' })
  address: string;

  @IsString({ message: 'Manager name must be a string' })
  @IsNotEmpty({ message: 'Manager name is required' })
  @MaxLength(255, { message: 'Manager name cannot exceed 255 characters' })
  manager_name: string;

  @IsString({ message: 'Manager phone must be a string' })
  @IsNotEmpty({ message: 'Manager phone is required' })
  @Matches(/^01[3-9]\d{8}$/, { message: 'Manager phone must be a valid Bangladeshi phone number (e.g., 01712345678)' })
  manager_phone: string;

  @IsOptional()
  @IsEmail({}, { message: 'Manager email must be a valid email address' })
  @MaxLength(255, { message: 'Manager email cannot exceed 255 characters' })
  manager_email?: string;

  @IsString({ message: 'Manager password must be a string' })
  @IsNotEmpty({ message: 'Manager password is required' })
  @MinLength(8, { message: 'Manager password must be at least 8 characters long' })
  @MaxLength(100, { message: 'Manager password cannot exceed 100 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { 
    message: 'Manager password must contain at least one uppercase letter, one lowercase letter, and one number' 
  })
  manager_password: string;

  @IsOptional()
  @IsUUID()
  manager_user_id?: string;
}
