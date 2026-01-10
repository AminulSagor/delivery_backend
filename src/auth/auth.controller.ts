import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthRefreshDto } from './dto/auth-refresh.dto';
import { AuthLogoutDto } from './dto/auth-logout.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/forgot-password.dto';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() loginDto: AuthLoginDto) {
    return await this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() refreshDto: AuthRefreshDto) {
    return await this.authService.refresh(refreshDto);
  }

  @Public()
  @Post('logout')
  async logout(@Body() logoutDto: AuthLogoutDto) {
    return await this.authService.logout(logoutDto.refreshToken);
  }

  @Post('change-password')
  async changePassword(@Request() req, @Body() dto: ChangePasswordDto) {
    return await this.authService.changePassword(req.user.userId, dto);
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return await this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return await this.authService.resetPassword(dto);
  }
}
