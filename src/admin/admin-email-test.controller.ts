import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { EmailService } from '../utils/email.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

class TestEmailDto {
  email: string;
}

@Controller('admin/email')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminEmailTestController {
  constructor(private readonly emailService: EmailService) {}

  /**
   * Verify email configuration
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyEmailConnection() {
    const isConnected = await this.emailService.verifyConnection();
    return {
      success: isConnected,
      message: isConnected 
        ? 'Email server connection verified successfully' 
        : 'Failed to connect to email server - check your SMTP credentials',
    };
  }

  /**
   * Send test email
   */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  async sendTestEmail(@Body() body: TestEmailDto) {
    const result = await this.emailService.sendTestEmail(body.email);
    return result;
  }
}
