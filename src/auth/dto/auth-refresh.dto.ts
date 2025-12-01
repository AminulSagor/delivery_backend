import { IsString, IsNotEmpty } from 'class-validator';

export class AuthRefreshDto {
  @IsString({ message: 'Refresh token must be a string' })
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken: string;
}
