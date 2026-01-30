import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/common/enums/user-role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { EmailService } from 'src/utils/email.service';

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
