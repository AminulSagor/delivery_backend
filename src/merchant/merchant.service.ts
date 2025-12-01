import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merchant } from './entities/merchant.entity';
import { User } from '../users/entities/user.entity';
import { MerchantSignupDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { UsersService } from '../users/users.service';
import { UserRole } from '../common/enums/user-role.enum';
import { MerchantStatus } from '../common/enums/merchant-status.enum';
import { EmailService } from '../utils/email.service';
import { SmsService } from '../utils/sms.service';

@Injectable()
export class MerchantService {
  constructor(
    @InjectRepository(Merchant)
    private merchantRepository: Repository<Merchant>,
    private usersService: UsersService,
    private emailService: EmailService,
    private smsService: SmsService,
  ) {}

  async signup(dto: MerchantSignupDto): Promise<Merchant> {
    // Check if phone already exists
    const existingUserByPhone = await this.usersService.findByPhone(dto.phone);
    if (existingUserByPhone) {
      throw new ConflictException('Phone number already registered');
    }

    // Check if email exists (if provided)
    if (dto.email) {
      const existingUserByEmail = await this.usersService.findByEmail(dto.email);
      if (existingUserByEmail) {
        throw new ConflictException('Email already registered');
      }
    }

    // Hash password
    const passwordHash = await this.usersService.hashPassword(dto.password);

    // Create user
    const user = await this.usersService.create({
      full_name: dto.full_name,
      phone: dto.phone,
      email: dto.email || undefined,
      password_hash: passwordHash,
      role: UserRole.MERCHANT,
      is_active: false, // Not active until approved
    });

    // Create merchant
    const merchant = new Merchant();
    merchant.user_id = user.id;
    merchant.thana = dto.thana;
    merchant.district = dto.district;
    merchant.full_address = dto.full_address || null;
    merchant.secondary_number = dto.secondary_number || null;
    merchant.status = MerchantStatus.PENDING;

    await this.merchantRepository.save(merchant);

    console.log(
      `[MERCHANT SIGNUP] New merchant registered: ${user.full_name} (${user.phone}) - Status: PENDING`,
    );

    return merchant;
  }

  async approveMerchant(
    merchantId: string,
    adminId: string,
  ): Promise<Merchant> {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
      relations: ['user'],
    });

    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${merchantId} not found`);
    }

    if (merchant.status === MerchantStatus.APPROVED) {
      throw new ConflictException('Merchant is already approved');
    }

    // Update merchant status
    merchant.status = MerchantStatus.APPROVED;
    merchant.approved_at = new Date();
    merchant.approved_by = adminId;

    // Activate user account
    await this.usersService.update(merchant.user_id, { is_active: true });

    // Save merchant changes
    await this.merchantRepository.save(merchant);

    // Reload merchant with updated user
    const updatedMerchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
      relations: ['user'],
    });

    if (!updatedMerchant) {
      throw new NotFoundException(`Merchant with ID ${merchantId} not found after update`);
    }

    console.log(
      `[MERCHANT APPROVAL] Merchant ${merchant.user.full_name} approved by admin ${adminId}`,
    );

    // Send approval notifications
    if (updatedMerchant.user.email) {
      const emailResult = await this.emailService.sendMerchantApprovalEmail(updatedMerchant);
      console.log(`[EMAIL] ${emailResult.message}`);
    }

    if (updatedMerchant.user.phone) {
      const smsResult = await this.smsService.sendMerchantApprovalSms(updatedMerchant);
      console.log(`[SMS] ${smsResult.message}`);
    }

    return updatedMerchant;
  }

  async findAll(filters?: {
    status?: MerchantStatus;
    district?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Merchant[]; total: number; page: number; limit: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const query = this.merchantRepository
      .createQueryBuilder('merchant')
      .leftJoinAndSelect('merchant.user', 'user');

    if (filters?.status) {
      query.andWhere('merchant.status = :status', { status: filters.status });
    }

    if (filters?.district) {
      query.andWhere('merchant.district ILIKE :district', {
        district: `%${filters.district}%`,
      });
    }

    const [data, total] = await query
      .skip(skip)
      .take(limit)
      .orderBy('merchant.created_at', 'DESC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Merchant> {
    const merchant = await this.merchantRepository.findOne({
      where: { id },
      relations: ['user', 'approver'],
    });

    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${id} not found`);
    }

    return merchant;
  }

  async update(id: string, dto: UpdateMerchantDto): Promise<Merchant> {
    const merchant = await this.findOne(id);
    
    Object.assign(merchant, dto);
    
    return await this.merchantRepository.save(merchant);
  }
}
