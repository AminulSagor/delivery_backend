import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Merchant } from '../merchant/entities/merchant.entity';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly emailEnabled: boolean;

  constructor(private configService: ConfigService) {
    // Check if email credentials are configured
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD');

    this.emailEnabled = !!(
      smtpUser &&
      smtpPassword &&
      smtpUser !== 'your-email@yourdomain.com'
    );

    if (this.emailEnabled) {
      // Create Zoho Mail transporter
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('SMTP_HOST', 'smtp.zoho.com'),
        port: this.configService.get<number>('SMTP_PORT', 465),
        secure: this.configService.get<boolean>('SMTP_SECURE', true), // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
        tls: {
          rejectUnauthorized: false, // For development only
        },
      });

      this.logger.log('✅ Email service initialized with Zoho Mail');
      this.logger.log(`📧 Email from: ${smtpUser}`);
    } else {
      this.logger.warn(
        '⚠️  Email service running in STUB mode - No credentials configured',
      );
    }
  }

  /**
   * Verify email connection
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.emailEnabled) {
      this.logger.warn('Email service not configured');
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log('✅ Email server connection verified');
      return true;
    } catch (error) {
      this.logger.error('❌ Email server connection failed', error);
      return false;
    }
  }

  /**
   * Send merchant approval email
   */
  async sendMerchantApprovalEmail(
    merchant: Merchant,
  ): Promise<{ success: boolean; stub?: boolean; message: string }> {
    if (!merchant.user?.email) {
      this.logger.warn(`Email skipped - no email for merchant ${merchant.id}`);
      return {
        success: false,
        stub: true,
        message: 'Email skipped - no email address',
      };
    }

    // If email is not enabled, use stub mode
    if (!this.emailEnabled) {
      this.logger.log(
        `[STUB] Sending approval email to ${merchant.user.email} for merchant ${merchant.user.full_name}`,
      );
      return {
        success: true,
        stub: true,
        message: `[STUB] Approval email would be sent to ${merchant.user.email}`,
      };
    }

    try {
      const fromEmail =
        this.configService.get<string>('EMAIL_FROM') ||
        this.configService.get<string>('SMTP_USER') ||
        '';

      const mailOptions = {
        from: {
          name: this.configService.get<string>(
            'EMAIL_FROM_NAME',
            'Courier Delivery Service',
          ),
          address: fromEmail,
        },
        to: merchant.user.email,
        subject: '🎉 Your Merchant Account Has Been Approved!',
        html: this.getApprovalEmailTemplate(merchant),
        text: this.getApprovalEmailText(merchant),
      };

      const info = await this.transporter.sendMail(mailOptions);

      this.logger.log(`✅ Approval email sent to ${merchant.user.email}`);
      if (info && typeof info === 'object' && 'messageId' in info) {
        this.logger.debug(`Email ID: ${info.messageId}`);
      }

      return {
        success: true,
        message: `Approval email sent to ${merchant.user.email}`,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to send approval email to ${merchant.user.email}`,
        error,
      );
      return {
        success: false,
        message: `Failed to send email: ${error.message}`,
      };
    }
  }

  /**
   * Send test email
   */
  async sendTestEmail(
    to: string,
  ): Promise<{ success: boolean; stub?: boolean; message: string }> {
    if (!this.emailEnabled) {
      this.logger.log(`[STUB] Would send test email to ${to}`);
      return {
        success: true,
        stub: true,
        message: `[STUB] Test email would be sent to ${to}`,
      };
    }

    try {
      const fromEmail =
        this.configService.get<string>('EMAIL_FROM') ||
        this.configService.get<string>('SMTP_USER') ||
        '';

      const mailOptions = {
        from: {
          name: this.configService.get<string>(
            'EMAIL_FROM_NAME',
            'Courier Delivery Service',
          ),
          address: fromEmail,
        },
        to,
        subject: '✅ Test Email from Courier Delivery Backend',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4CAF50;">✅ Email Service is Working!</h1>
            <p>This is a test email from your Courier Delivery Backend.</p>
            <p><strong>Configuration:</strong></p>
            <ul>
              <li>SMTP Host: ${this.configService.get<string>('SMTP_HOST')}</li>
              <li>SMTP Port: ${this.configService.get<number>('SMTP_PORT')}</li>
              <li>From: ${this.configService.get<string>('SMTP_USER')}</li>
            </ul>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              Sent at: ${new Date().toLocaleString()}
            </p>
          </div>
        `,
        text: `Test Email from Courier Delivery Backend\n\nEmail service is working correctly!\n\nSent at: ${new Date().toLocaleString()}`,
      };

      const info = await this.transporter.sendMail(mailOptions);

      this.logger.log(`✅ Test email sent to ${to}`);
      if (info && typeof info === 'object' && 'messageId' in info) {
        this.logger.debug(`Email ID: ${info.messageId}`);
      }

      return {
        success: true,
        message: `Test email sent to ${to}`,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to send test email to ${to}`, error);
      return {
        success: false,
        message: `Failed to send test email: ${error.message}`,
      };
    }
  }

  /**
   * HTML template for approval email
   */
  private getApprovalEmailTemplate(merchant: Merchant): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4CAF50; margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
          </div>

          <!-- Body -->
          <div style="padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Dear <strong>${merchant.user.full_name}</strong>,
            </p>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              We are pleased to inform you that your merchant account has been <strong style="color: #4CAF50;">APPROVED</strong>!
            </p>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              You can now start using our courier delivery service to ship your products.
            </p>

            <!-- Merchant Details -->
            <div style="margin: 20px 0; padding: 15px; background-color: #fff; border-left: 4px solid #4CAF50; border-radius: 4px;">
              <h3 style="margin-top: 0; color: #333;">Your Account Details:</h3>
              <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="padding: 5px 0;"><strong>Phone:</strong> ${merchant.user.phone}</li>
                <li style="padding: 5px 0;"><strong>Email:</strong> ${merchant.user.email}</li>
                <li style="padding: 5px 0;"><strong>Location:</strong> ${merchant.thana}, ${merchant.district}</li>
                <li style="padding: 5px 0;"><strong>Approved At:</strong> ${new Date(merchant.approved_at).toLocaleString()}</li>
              </ul>
            </div>

            <!-- Next Steps -->
            <h3 style="color: #333;">Next Steps:</h3>
            <ol style="color: #666; line-height: 1.8;">
              <li>Login to your merchant dashboard</li>
              <li>Complete your business profile</li>
              <li>Start creating delivery orders</li>
            </ol>
          </div>

          <!-- Footer -->
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
            <p style="color: #999; font-size: 14px; margin: 0;">
              If you have any questions, please contact our support team.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 10px;">
              © ${new Date().getFullYear()} Courier Delivery Service. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Plain text version of approval email
   */
  private getApprovalEmailText(merchant: Merchant): string {
    return `
Congratulations!

Dear ${merchant.user.full_name},

We are pleased to inform you that your merchant account has been APPROVED!

You can now start using our courier delivery service to ship your products.

Your Account Details:
- Phone: ${merchant.user.phone}
- Email: ${merchant.user.email}
- Location: ${merchant.thana}, ${merchant.district}
- Approved At: ${new Date(merchant.approved_at).toLocaleString()}

Next Steps:
1. Login to your merchant dashboard
2. Complete your business profile
3. Start creating delivery orders

If you have any questions, please contact our support team.

© ${new Date().getFullYear()} Courier Delivery Service. All rights reserved.
    `.trim();
  }

  async sendGenericEmail(
    to: string,
    subject: string,
    htmlBody: string,
  ): Promise<boolean> {
    if (!this.emailEnabled) {
      this.logger.log(`[STUB] Would send generic email to ${to}: ${subject}`);
      return true;
    }

    try {
      const fromEmail =
        this.configService.get<string>('EMAIL_FROM') ||
        this.configService.get<string>('SMTP_USER') ||
        '';

      const mailOptions = {
        from: {
          name: this.configService.get<string>(
            'EMAIL_FROM_NAME',
            'Courier Delivery Service',
          ),
          address: fromEmail,
        },
        to,
        subject,
        html: htmlBody,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Generic email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to send generic email to ${to}`, error);
      return false; // Return false so the caller knows it failed
    }
  }
}
