import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { SmsService } from '../utils/sms.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

class TestSmsDto {
  phone: string;
}

class SmsReportDto {
  requestId: number;
}

@Controller('admin/sms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminSmsTestController {
  constructor(private readonly smsService: SmsService) {}

  /**
   * Check SMS balance
   */
  @Post('balance')
  @HttpCode(HttpStatus.OK)
  async checkBalance() {
    const result = await this.smsService.checkBalance();
    return result;
  }

  /**
   * Send test SMS
   */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  async sendTestSms(@Body() body: TestSmsDto) {
    const result = await this.smsService.sendTestSms(body.phone);
    return result;
  }

  /**
   * Get SMS report
   */
  @Post('report')
  @HttpCode(HttpStatus.OK)
  async getSmsReport(@Body() body: SmsReportDto) {
    const result = await this.smsService.getSmsReport(body.requestId);
    return result;
  }
}
