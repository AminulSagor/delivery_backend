import { IsString, IsNotEmpty } from 'class-validator';

export class AuthLogoutDto {
  @IsString({ message: 'Refresh token must be a string' })
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken: string;
}
