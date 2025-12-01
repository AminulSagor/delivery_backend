import { IsString, IsNotEmpty } from 'class-validator';

export class AuthLoginDto {
  @IsString({ message: 'Identifier must be a string' })
  @IsNotEmpty({ message: 'Identifier is required' })
  identifier: string; // Can be phone or email

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
