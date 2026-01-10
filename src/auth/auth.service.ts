import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { SignOptions } from 'jsonwebtoken';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { HubManager } from '../hubs/entities/hub-manager.entity';
import { Rider } from '../riders/entities/rider.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { MerchantStatus } from '../common/enums/merchant-status.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthRefreshDto } from './dto/auth-refresh.dto';
import { SmsService } from 'src/utils/sms.service';
import { EmailService } from 'src/utils/email.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/forgot-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    @InjectRepository(Merchant)
    private merchantRepository: Repository<Merchant>,
    @InjectRepository(HubManager)
    private hubManagerRepository: Repository<HubManager>,
    @InjectRepository(Rider)
    private riderRepository: Repository<Rider>,
    private smsService: SmsService,
    private emailService: EmailService,
  ) {}

  async login(loginDto: AuthLoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
  }> {
    const { identifier, password } = loginDto;

    // Find user
    const user = await this.usersService.findByPhoneOrEmail(identifier);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Validate password
    const isPasswordValid = await this.usersService.comparePassword(
      password,
      user.password_hash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if merchant is approved
    if (user.role === UserRole.MERCHANT) {
      const merchant = await this.merchantRepository.findOne({
        where: { user_id: user.id },
      });
      if (!merchant || merchant.status !== MerchantStatus.APPROVED) {
        throw new UnauthorizedException(
          'Your account is pending approval. Please wait for admin approval.',
        );
      }
    }

    // Check if user is active
    if (!user.is_active) {
      throw new UnauthorizedException('Your account is not active');
    }

    // Generate tokens
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store refresh token
    await this.usersService.updateRefreshToken(user.id, refreshToken);

    // Return response
    const { password_hash, refresh_token, ...userWithoutSensitive } = user;
    return {
      accessToken,
      refreshToken,
      user: userWithoutSensitive,
    };
  }

  async refresh(refreshDto: AuthRefreshDto): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const { refreshToken } = refreshDto;

    try {
      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_SECRET || 'secret',
      ) as { userId: string };

      // Find user and verify refresh token matches
      const user = await this.usersService.findById(decoded.userId);
      if (!user || user.refresh_token !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const newAccessToken = await this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      // Update stored refresh token
      await this.usersService.updateRefreshToken(user.id, newRefreshToken);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_SECRET || 'secret',
      ) as { userId: string };

      const user = await this.usersService.findById(decoded.userId);
      if (user && user.refresh_token === refreshToken) {
        await this.usersService.updateRefreshToken(user.id, null);
      }

      return { message: 'Logged out successfully' };
    } catch (error) {
      return { message: 'Logged out successfully' };
    }
  }

  private async generateAccessToken(user: User): Promise<string> {
    // Fetch additional context based on role
    let merchantId: string | null = null;
    let hubId: string | null = null;
    let riderId: string | null = null;

    if (user.role === UserRole.MERCHANT) {
      const merchant = await this.merchantRepository.findOne({
        where: { user_id: user.id },
      });
      merchantId = merchant?.id || null;
    } else if (user.role === UserRole.HUB_MANAGER) {
      const hubManager = await this.hubManagerRepository.findOne({
        where: { user_id: user.id },
      });
      hubId = hubManager?.hub_id || null;
    } else if (user.role === UserRole.RIDER) {
      const rider = await this.riderRepository.findOne({
        where: { user_id: user.id },
      });
      hubId = rider?.hub_id || null;
      riderId = rider?.id || null;
    }

    const payload: JwtPayload = {
      userId: user.id,
      phone: user.phone,
      role: user.role,
      merchantId,
      hubId,
      riderId,
    };

    const options: SignOptions = {
      expiresIn: '60d', // Set to 60 days for development and testing
    };
    return jwt.sign(payload, process.env.JWT_SECRET || 'secret', options);
  }

  private generateRefreshToken(user: User): string {
    const payload = {
      userId: user.id,
    };
    const options: SignOptions = {
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
    };
    return jwt.sign(payload, process.env.JWT_SECRET || 'secret', options);
  }

  async validateToken(token: string): Promise<any> {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'secret');
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  // ==========================================
  // 1. CHANGE PASSWORD (Logged In User)
  // ==========================================
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // 1. Verify Old Password
    const isMatch = await bcrypt.compare(
      dto.currentPassword,
      user.password_hash,
    );
    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // 2. Hash New Password
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(dto.newPassword, salt);

    // 3. Update User
    // Note: You might need to add an update method to UsersService or use a repo here
    // Assuming UsersService has an update method, otherwise we access repo via service if exposed
    // For this example, I'll assume we can call an update on UsersService
    await this.usersService.updatePassword(user.id, newHash);

    return { message: 'Password changed successfully' };
  }

  // ==========================================
  // 2. FORGOT PASSWORD (Generate OTP)
  // ==========================================
  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string; devOtp?: string }> {
    const { identifier } = dto;

    // 1. Find User
    const user = await this.usersService.findByPhoneOrEmail(identifier);
    if (!user) throw new NotFoundException('User not found');

    // 2. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // Expires in 5 minutes

    // 3. Save OTP to DB
    await this.usersService.updateOtp(user.id, otp, expiresAt);

    // 4. Send Notifications
    const promises: Promise<any>[] = [];

    // Send SMS if phone exists
    if (user.phone) {
      const smsMsg = `Your Courier App password reset OTP is: ${otp}. Valid for 5 minutes.`;
      promises.push(this.smsService.sendSms(user.phone, smsMsg));
    }

    // Send Email if email exists
    if (user.email) {
      const emailHtml = `
        <h3>Password Reset Request</h3>
        <p>Your OTP is: <strong>${otp}</strong></p>
        <p>This OTP is valid for 5 minutes.</p>
      `;

      promises.push(
        this.emailService.sendGenericEmail(
          user.email,
          'Password Reset OTP',
          emailHtml,
        ),
      );
    }

    await Promise.allSettled(promises);

    // For Development only (Remove in Production)
    return {
      message: 'OTP sent successfully',
      // devOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
    };
  }

  // ==========================================
  // 3. RESET PASSWORD (Verify OTP & Set New)
  // ==========================================
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const { identifier, otp, newPassword } = dto;

    // 1. Find User
    const user = await this.usersService.findByPhoneOrEmail(identifier);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Validate OTP
    if (user.reset_otp !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    // 3. Validate Expiry
    if (!user.reset_otp_expires || new Date() > user.reset_otp_expires) {
      throw new BadRequestException('OTP has expired');
    }

    // 4. Hash New Password
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    // 5. Update Password and Clear OTP
    await this.usersService.updatePasswordAndClearOtp(user.id, newHash);

    return { message: 'Password has been reset successfully. Please login.' };
  }
}
