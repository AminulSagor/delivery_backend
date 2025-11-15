import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Merchant } from '../merchant/entities/merchant.entity';

interface SmsResponse {
  error: number;
  msg: string;
  data?: {
    request_id: number;
  };
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly smsEnabled: boolean;
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly senderId: string;
  private readonly contentId: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('SMS_API_KEY', '');
    this.apiUrl = this.configService.get<string>('SMS_API_URL', 'https://api.sms.net.bd/sendsms');
    this.senderId = this.configService.get<string>('SMS_SENDER_ID', '');
    this.contentId = this.configService.get<string>('SMS_CONTENT_ID', '');
    
    // Check if SMS credentials are configured
    this.smsEnabled = !!(this.apiKey && this.apiKey !== 'your-sms-api-key-here');

    if (this.smsEnabled) {
      this.logger.log('✅ SMS service initialized with SMS.net.bd');
      this.logger.log(`📱 SMS API URL: ${this.apiUrl}`);
    } else {
      this.logger.warn('⚠️  SMS service running in STUB mode - No API key configured');
    }
  }

  /**
   * Check SMS balance
   */
  async checkBalance(): Promise<{ success: boolean; balance?: string; message: string }> {
    if (!this.smsEnabled) {
      this.logger.warn('SMS service not configured');
      return {
        success: false,
        message: 'SMS service not configured',
      };
    }

    try {
      const balanceUrl = 'https://api.sms.net.bd/user/balance/';
      const response = await fetch(`${balanceUrl}?api_key=${this.apiKey}`);
      const data = await response.json();

      if (data.error === 0) {
        this.logger.log(`💰 SMS Balance: ${data.data.balance} BDT`);
        return {
          success: true,
          balance: data.data.balance,
          message: 'Balance retrieved successfully',
        };
      } else {
        this.logger.error(`❌ Balance check failed: ${data.msg}`);
        return {
          success: false,
          message: data.msg || 'Failed to check balance',
        };
      }
    } catch (error) {
      this.logger.error('❌ Balance check error', error);
      return {
        success: false,
        message: `Error checking balance: ${error.message}`,
      };
    }
  }

  /**
   * Send SMS using SMS.net.bd API
   */
  private async sendSms(to: string, message: string): Promise<{ success: boolean; requestId?: number; message: string }> {
    if (!this.smsEnabled) {
      this.logger.log(`[STUB] Would send SMS to ${to}: ${message}`);
      return {
        success: true,
        message: '[STUB] SMS would be sent in production mode',
      };
    }

    try {
      // Format phone number - ensure it starts with 880
      let formattedPhone = to.replace(/\D/g, ''); // Remove non-digits
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '880' + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith('880')) {
        formattedPhone = '880' + formattedPhone;
      }

      // Prepare form data
      const formData = new URLSearchParams();
      formData.append('api_key', this.apiKey);
      formData.append('msg', message);
      formData.append('to', formattedPhone);
      
      if (this.senderId) {
        formData.append('sender_id', this.senderId);
      }
      
      if (this.contentId) {
        formData.append('content_id', this.contentId);
      }

      // Send request
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const data: SmsResponse = await response.json();

      if (data.error === 0) {
        this.logger.log(`✅ SMS sent to ${formattedPhone}`);
        if (data.data?.request_id) {
          this.logger.debug(`SMS Request ID: ${data.data.request_id}`);
        }
        return {
          success: true,
          requestId: data.data?.request_id,
          message: data.msg || 'SMS sent successfully',
        };
      } else {
        this.logger.error(`❌ SMS failed: ${data.msg} (Error ${data.error})`);
        return {
          success: false,
          message: this.getErrorMessage(data.error, data.msg),
        };
      }
    } catch (error) {
      this.logger.error(`❌ SMS send error to ${to}`, error);
      return {
        success: false,
        message: `Failed to send SMS: ${error.message}`,
      };
    }
  }

  /**
   * Send merchant approval SMS
   */
  async sendMerchantApprovalSms(
    merchant: Merchant,
  ): Promise<{ success: boolean; stub?: boolean; message: string; requestId?: number }> {
    if (!merchant.user?.phone) {
      this.logger.warn(`SMS skipped - no phone for merchant ${merchant.id}`);
      return {
        success: false,
        stub: true,
        message: 'SMS skipped - no phone number',
      };
    }

    // If SMS is not enabled, use stub mode
    if (!this.smsEnabled) {
      this.logger.log(
        `[STUB] Sending approval SMS to ${merchant.user.phone} for merchant ${merchant.user.full_name}`,
      );
      return {
        success: true,
        stub: true,
        message: `[STUB] Approval SMS would be sent to ${merchant.user.phone}`,
      };
    }

    // Prepare SMS message
    const message = this.getApprovalSmsMessage(merchant);

    // Send SMS
    const result = await this.sendSms(merchant.user.phone, message);

    if (result.success) {
      this.logger.log(`✅ Approval SMS sent to ${merchant.user.phone}`);
    }

    return result;
  }

  /**
   * Send test SMS
   */
  async sendTestSms(to: string): Promise<{ success: boolean; stub?: boolean; message: string; requestId?: number }> {
    if (!this.smsEnabled) {
      this.logger.log(`[STUB] Would send test SMS to ${to}`);
      return {
        success: true,
        stub: true,
        message: `[STUB] Test SMS would be sent to ${to}`,
      };
    }

    const testMessage = `Test SMS from Courier Delivery Service. Your SMS service is working correctly! Time: ${new Date().toLocaleString()}`;

    const result = await this.sendSms(to, testMessage);

    if (result.success) {
      this.logger.log(`✅ Test SMS sent to ${to}`);
    }

    return result;
  }

  /**
   * Get approval SMS message template
   */
  private getApprovalSmsMessage(merchant: Merchant): string {
    return `Congratulations ${merchant.user.full_name}! Your merchant account has been APPROVED. You can now login and start using our courier delivery service. - Courier Delivery`;
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(errorCode: number, defaultMsg: string): string {
    const errorMessages: Record<number, string> = {
      400: 'Invalid request - missing or invalid parameter',
      403: 'Permission denied',
      404: 'Resource not found',
      405: 'Authorization required',
      409: 'Server error occurred',
      410: 'Account expired',
      411: 'Reseller account expired or suspended',
      412: 'Invalid schedule',
      413: 'Invalid sender ID',
      414: 'Message is empty',
      415: 'Message is too long',
      416: 'No valid phone number found',
      417: 'Insufficient balance',
      420: 'Content blocked',
      421: 'You can only send SMS to registered phone until first recharge',
    };

    return errorMessages[errorCode] || defaultMsg || `Error ${errorCode}`;
  }

  /**
   * Get SMS report by request ID
   */
  async getSmsReport(requestId: number): Promise<any> {
    if (!this.smsEnabled) {
      return {
        success: false,
        message: 'SMS service not configured',
      };
    }

    try {
      const reportUrl = `https://api.sms.net.bd/report/request/${requestId}/`;
      const response = await fetch(`${reportUrl}?api_key=${this.apiKey}`);
      const data = await response.json();

      if (data.error === 0) {
        this.logger.log(`📊 SMS Report retrieved for request ${requestId}`);
        return {
          success: true,
          data: data.data,
        };
      } else {
        return {
          success: false,
          message: data.msg || 'Failed to get report',
        };
      }
    } catch (error) {
      this.logger.error('❌ Report retrieval error', error);
      return {
        success: false,
        message: `Error getting report: ${error.message}`,
      };
    }
  }
}
