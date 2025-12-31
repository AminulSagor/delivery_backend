import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
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
import { MerchantPayoutMethod } from './entities/merchant-payout-method.entity';
import { PayoutTransaction } from './entities/payout-transaction.entity';
import { PayoutMethodType } from '../common/enums/payout-method-type.enum';
import { PayoutMethodStatus } from '../common/enums/payout-method-status.enum';
import { AddPayoutMethodDto } from './dto/add-payout-method.dto';
import { UpdatePayoutMethodDto } from './dto/update-payout-method.dto';

@Injectable()
export class MerchantService {
  constructor(
    @InjectRepository(Merchant)
    private merchantRepository: Repository<Merchant>,
    @InjectRepository(MerchantPayoutMethod)
    private payoutMethodRepository: Repository<MerchantPayoutMethod>,
    @InjectRepository(PayoutTransaction)
    private payoutTransactionRepository: Repository<PayoutTransaction>,
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

  // ===== PAYOUT METHOD MANAGEMENT =====

  /**
   * Get available payout methods for merchant
   */
  async getAvailablePayoutMethods(merchantId: string): Promise<PayoutMethodType[]> {
    const existingMethods = await this.payoutMethodRepository.find({
      where: { merchant_id: merchantId },
      select: ['method_type'],
    });

    const usedMethods = existingMethods.map(m => m.method_type);
    const allMethods = Object.values(PayoutMethodType);

    return allMethods.filter(method => !usedMethods.includes(method));
  }

  /**
   * Get merchant's current payout methods
   */
  async getMerchantPayoutMethods(merchantId: string): Promise<MerchantPayoutMethod[]> {
    return await this.payoutMethodRepository.find({
      where: { merchant_id: merchantId },
      relations: ['verifier'],
      order: { is_default: 'DESC', created_at: 'ASC' },
    });
  }

  /**
   * Add payout method
   */
  async addPayoutMethod(
    merchantId: string,
    dto: AddPayoutMethodDto,
  ): Promise<MerchantPayoutMethod> {
    // Check if method already exists
    const existing = await this.payoutMethodRepository.findOne({
      where: { merchant_id: merchantId, method_type: dto.method_type },
    });

    if (existing) {
      throw new ConflictException(`${dto.method_type} payout method already exists`);
    }

    // Create payout method
    const payoutMethod = this.payoutMethodRepository.create({
      merchant_id: merchantId,
      method_type: dto.method_type,
      status: dto.method_type === PayoutMethodType.CASH
        ? PayoutMethodStatus.VERIFIED  // Auto-verify cash
        : PayoutMethodStatus.PENDING,
      verified_at: dto.method_type === PayoutMethodType.CASH ? new Date() : null,
      // Bank account fields
      bank_name: dto.bank_name || null,
      branch_name: dto.branch_name || null,
      account_holder_name: dto.account_holder_name || null,
      account_number: dto.account_number || null,
      routing_number: dto.routing_number || null,
      // bKash fields
      bkash_number: dto.bkash_number || null,
      bkash_account_holder_name: dto.bkash_account_holder_name || null,
      bkash_account_type: dto.bkash_account_type || null,
      // Nagad fields
      nagad_number: dto.nagad_number || null,
      nagad_account_holder_name: dto.nagad_account_holder_name || null,
      nagad_account_type: dto.nagad_account_type || null,
    });

    const saved = await this.payoutMethodRepository.save(payoutMethod);

    // If no default exists and this is verified, set as default
    const hasDefault = await this.payoutMethodRepository.findOne({
      where: { merchant_id: merchantId, is_default: true },
    });

    if (!hasDefault && saved.status === PayoutMethodStatus.VERIFIED) {
      saved.is_default = true;
      await this.payoutMethodRepository.save(saved);
    }

    return saved;
  }

  /**
   * Update payout method
   */
  async updatePayoutMethod(
    merchantId: string,
    methodId: string,
    dto: UpdatePayoutMethodDto,
  ): Promise<MerchantPayoutMethod> {
    const method = await this.payoutMethodRepository.findOne({
      where: { id: methodId, merchant_id: merchantId },
    });

    if (!method) {
      throw new NotFoundException('Payout method not found');
    }

    // Update fields based on method type
    Object.assign(method, dto);
    
    return await this.payoutMethodRepository.save(method);
  }

  /**
   * Delete payout method
   */
  async deletePayoutMethod(merchantId: string, methodId: string): Promise<void> {
    const method = await this.payoutMethodRepository.findOne({
      where: { id: methodId, merchant_id: merchantId },
    });

    if (!method) {
      throw new NotFoundException('Payout method not found');
    }

    // If deleting default, unset it
    if (method.is_default) {
      method.is_default = false;
      await this.payoutMethodRepository.save(method);
    }

    await this.payoutMethodRepository.remove(method);
  }

  /**
   * Verify payout method (Admin only)
   */
  async verifyPayoutMethod(
    methodId: string,
    adminId: string,
  ): Promise<MerchantPayoutMethod> {
    const method = await this.payoutMethodRepository.findOne({
      where: { id: methodId },
    });

    if (!method) {
      throw new NotFoundException('Payout method not found');
    }

    method.status = PayoutMethodStatus.VERIFIED;
    method.verified_at = new Date();
    method.verified_by = adminId;

    const saved = await this.payoutMethodRepository.save(method);

    // If no default exists, set this as default
    const hasDefault = await this.payoutMethodRepository.findOne({
      where: { merchant_id: method.merchant_id, is_default: true },
    });

    if (!hasDefault) {
      saved.is_default = true;
      await this.payoutMethodRepository.save(saved);
    }

    return saved;
  }

  /**
   * Set default payout method (Merchant - from verified methods)
   */
  async setDefaultPayoutMethod(
    merchantId: string,
    methodId: string,
  ): Promise<MerchantPayoutMethod> {
    const method = await this.payoutMethodRepository.findOne({
      where: { id: methodId, merchant_id: merchantId },
    });

    if (!method) {
      throw new NotFoundException('Payout method not found');
    }

    if (method.status !== PayoutMethodStatus.VERIFIED) {
      throw new BadRequestException('Only verified methods can be set as default');
    }

    // Unset current default
    await this.payoutMethodRepository.update(
      { merchant_id: merchantId, is_default: true },
      { is_default: false },
    );

    // Set new default
    method.is_default = true;
    return await this.payoutMethodRepository.save(method);
  }

  /**
   * Get payout transactions for merchant
   */
  async getPayoutTransactions(
    merchantId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await this.payoutTransactionRepository.findAndCount({
      where: { merchant_id: merchantId },
      relations: ['payout_method', 'initiator'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    return {
      transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
