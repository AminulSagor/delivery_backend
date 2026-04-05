import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdateRiderPasswordDto {
  @IsNotEmpty()
  @IsString()
  current_password: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  new_password: string;

  @IsNotEmpty()
  @IsString()
  confirm_new_password: string;
}
