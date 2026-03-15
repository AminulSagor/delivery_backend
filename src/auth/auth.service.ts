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
import { MerchantProfile } from '../merchant/entities/merchant-profile.entity';
import { HubManager } from '../hubs/entities/hub-manager.entity';
import { Hub } from '../hubs/entities/hub.entity';
import { Rider } from '../riders/entities/rider.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthRefreshDto } from './dto/auth-refresh.dto';
import { SmsService } from 'src/utils/sms.service';
import { EmailService } from 'src/utils/email.service';
import { ConfigService } from '@nestjs/config';
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
    @InjectRepository(MerchantProfile)
    private merchantProfileRepository: Repository<MerchantProfile>,
    @InjectRepository(HubManager)
    private hubManagerRepository: Repository<HubManager>,
    @InjectRepository(Hub)
    private hubRepository: Repository<Hub>,
    @InjectRepository(Rider)
    private riderRepository: Repository<Rider>,
    private smsService: SmsService,
    private emailService: EmailService,
    private configService: ConfigService,
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
    let hubManagerId: string | null = null;
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
      hubManagerId = hubManager?.id || null; // Store HubManager entity ID
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
      hubManagerId,
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

    // 2. Generate 6-digit OTP (or use default OTP if enabled)
    const defaultEnabled = this.configService.get<string>('OTP_DEFAULT_ENABLED', 'false').toLowerCase() === 'true';
    const otp = defaultEnabled
      ? this.configService.get<string>('OTP_DEFAULT_VALUE', '1234')
      : Math.floor(100000 + Math.random() * 900000).toString();
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

  // ==========================================
  // 4. GET CURRENT USER PROFILE (/me)
  // ==========================================
  async getProfile(userId: string): Promise<any> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Base user info (exclude sensitive fields)
    const baseProfile = {
      user_id: user.id,
      full_name: user.full_name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
    };

    // Add role-specific data
    switch (user.role) {
      case UserRole.MERCHANT:
        return this.getMerchantProfile(baseProfile);

      case UserRole.HUB_MANAGER:
        return this.getHubManagerProfile(baseProfile);

      case UserRole.RIDER:
        return this.getRiderProfile(baseProfile);

      case UserRole.ADMIN:
        return {
          ...baseProfile,
        };

      default:
        return baseProfile;
    }
  }

  private async getMerchantProfile(baseProfile: any): Promise<any> {
    const merchant = await this.merchantRepository.findOne({
      where: { user_id: baseProfile.user_id },
      relations: ['merchant_profile'],
    });

    if (!merchant) {
      return {
        ...baseProfile,
        merchant_id: null,
        merchant: null,
      };
    }

    return {
      ...baseProfile,
      merchant_id: merchant.id,
      merchant: {
        id: merchant.id,
        thana: merchant.thana,
        district: merchant.district,
        full_address: merchant.full_address,
        secondary_number: merchant.secondary_number,
        status: merchant.status,
        approved_at: merchant.approved_at,
        profile: merchant.merchant_profile ? {
          profile_img_url: merchant.merchant_profile.profile_img_url,
          nid_number: merchant.merchant_profile.nid_number,
          nid_front_url: merchant.merchant_profile.nid_front_url,
          nid_back_url: merchant.merchant_profile.nid_back_url,
          nid_verified: merchant.merchant_profile.nid_verified || false,
          trade_license_number: merchant.merchant_profile.trade_license_number,
          trade_license_url: merchant.merchant_profile.trade_license_url,
          trade_license_verified: merchant.merchant_profile.trade_license_verified || false,
          tin_number: merchant.merchant_profile.tin_number,
          tin_certificate_url: merchant.merchant_profile.tin_certificate_url,
          tin_verified: merchant.merchant_profile.tin_verified || false,
          bin_number: merchant.merchant_profile.bin_number,
          bin_certificate_url: merchant.merchant_profile.bin_certificate_url,
          bin_verified: merchant.merchant_profile.bin_verified || false,
        } : null,
      },
    };
  }

  private async getHubManagerProfile(baseProfile: any): Promise<any> {
    const hubManager = await this.hubManagerRepository.findOne({
      where: { user_id: baseProfile.user_id },
      relations: ['hub'],
    });

    if (!hubManager) {
      return {
        ...baseProfile,
        hub_manager_id: null,
        hub_id: null,
        hub: null,
      };
    }

    return {
      ...baseProfile,
      hub_manager_id: hubManager.id,
      hub_id: hubManager.hub_id,
      hub: hubManager.hub ? {
        id: hubManager.hub.id,
        hub_code: hubManager.hub.hub_code,
        branch_name: hubManager.hub.branch_name,
        area: hubManager.hub.area,
        address: hubManager.hub.address,
      } : null,
    };
  }

  private async getRiderProfile(baseProfile: any): Promise<any> {
    const rider = await this.riderRepository.findOne({
      where: { user_id: baseProfile.user_id },
      relations: ['hub'],
    });

    if (!rider) {
      return {
        ...baseProfile,
        rider_id: null,
        hub_id: null,
        rider: null,
        hub: null,
      };
    }

    return {
      ...baseProfile,
      rider_id: rider.id,
      hub_id: rider.hub_id,
      rider: {
        id: rider.id,
        photo: rider.photo,
        guardian_mobile_no: rider.guardian_mobile_no,
        bike_type: rider.bike_type,
        nid_number: rider.nid_number,
        license_no: rider.license_no,
        present_address: rider.present_address,
        permanent_address: rider.permanent_address,
        fixed_salary: rider.fixed_salary,
        commission_per_delivery: rider.commission_per_delivery,
        bank_name: rider.bank_name,
        bank_account_number: rider.bank_account_number,
        bank_branch: rider.bank_branch,
        is_active: rider.is_active,
      },
      hub: rider.hub ? {
        id: rider.hub.id,
        hub_code: rider.hub.hub_code,
        branch_name: rider.hub.branch_name,
        area: rider.hub.area,
        address: rider.hub.address,
      } : null,
    };
  }
}
