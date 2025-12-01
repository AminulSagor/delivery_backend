import { IsString, IsOptional, IsUUID, MaxLength, IsNotEmpty } from 'class-validator';

export class UpdateHubDto {
  @IsOptional()
  @IsString({ message: 'Branch name must be a string' })
  @IsNotEmpty({ message: 'Branch name cannot be empty' })
  @MaxLength(255, { message: 'Branch name cannot exceed 255 characters' })
  branch_name?: string;

  @IsOptional()
  @IsString({ message: 'Area must be a string' })
  @IsNotEmpty({ message: 'Area cannot be empty' })
  @MaxLength(255, { message: 'Area cannot exceed 255 characters' })
  area?: string;

  @IsOptional()
  @IsString({ message: 'Address must be a string' })
  @IsNotEmpty({ message: 'Address cannot be empty' })
  address?: string;

  @IsOptional()
  @IsString({ message: 'Manager name must be a string' })
  @IsNotEmpty({ message: 'Manager name cannot be empty' })
  @MaxLength(255, { message: 'Manager name cannot exceed 255 characters' })
  manager_name?: string;

  @IsOptional()
  @IsString({ message: 'Manager phone must be a string' })
  @IsNotEmpty({ message: 'Manager phone cannot be empty' })
  @MaxLength(50, { message: 'Manager phone cannot exceed 50 characters' })
  manager_phone?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Manager user ID must be a valid UUID' })
  manager_user_id?: string;
}
