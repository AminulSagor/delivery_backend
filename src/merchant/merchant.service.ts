import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
import { MerchantProfile } from './entities/merchant-profile.entity';
import { Store } from 'src/stores/entities/store.entity';
import {
  UpdateBinDto,
  UpdateNidDto,
  UpdateProfileDetailsDto,
  UpdateTinDto,
  UpdateTradeLicenseDto,
} from './dto/update-profile-details.dto';

@Injectable()
export class MerchantService {
  constructor(
    @InjectRepository(Merchant)
    private merchantRepository: Repository<Merchant>,
    @InjectRepository(MerchantPayoutMethod)
    private payoutMethodRepository: Repository<MerchantPayoutMethod>,
    @InjectRepository(PayoutTransaction)
    private payoutTransactionRepository: Repository<PayoutTransaction>,
    @InjectRepository(MerchantProfile)
    private profileRepo: Repository<MerchantProfile>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Store)
    private storeRepo: Repository<Store>,
    private dataSource: DataSource,
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
      const existingUserByEmail = await this.usersService.findByEmail(
        dto.email,
      );
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
    // Validate admin user exists (prevents FK constraint violation)
    const adminUser = await this.usersService.findById(adminId);
    if (!adminUser) {
      throw new NotFoundException(
        `Admin user with ID ${adminId} not found. Please ensure you are logged in with a valid admin account.`,
      );
    }

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
      throw new NotFoundException(
        `Merchant with ID ${merchantId} not found after update`,
      );
    }

    console.log(
      `[MERCHANT APPROVAL] Merchant ${merchant.user.full_name} approved by admin ${adminId}`,
    );

    // Send approval notifications
    if (updatedMerchant.user.email) {
      const emailResult =
        await this.emailService.sendMerchantApprovalEmail(updatedMerchant);
      console.log(`[EMAIL] ${emailResult.message}`);
    }

    if (updatedMerchant.user.phone) {
      const smsResult =
        await this.smsService.sendMerchantApprovalSms(updatedMerchant);
      console.log(`[SMS] ${smsResult.message}`);
    }

    return updatedMerchant;
  }

  async findAll(filters?: {
    status?: MerchantStatus;
    district?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Merchant[];
    total: number;
    page: number;
    limit: number;
  }> {
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
  async getAvailablePayoutMethods(
    merchantId: string,
  ): Promise<PayoutMethodType[]> {
    const existingMethods = await this.payoutMethodRepository.find({
      where: { merchant_id: merchantId },
      select: ['method_type'],
    });

    const usedMethods = existingMethods.map((m) => m.method_type);
    const allMethods = Object.values(PayoutMethodType);

    return allMethods.filter((method) => !usedMethods.includes(method));
  }

  /**
   * Get merchant's current payout methods
   */
  async getMerchantPayoutMethods(
    merchantId: string,
  ): Promise<MerchantPayoutMethod[]> {
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
      throw new ConflictException(
        `${dto.method_type} payout method already exists`,
      );
    }

    // Create payout method
    const payoutMethod = this.payoutMethodRepository.create({
      merchant_id: merchantId,
      method_type: dto.method_type,
      status:
        dto.method_type === PayoutMethodType.CASH
          ? PayoutMethodStatus.VERIFIED // Auto-verify cash
          : PayoutMethodStatus.PENDING,
      verified_at:
        dto.method_type === PayoutMethodType.CASH ? new Date() : null,
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
  async deletePayoutMethod(
    merchantId: string,
    methodId: string,
  ): Promise<void> {
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
      throw new BadRequestException(
        'Only verified methods can be set as default',
      );
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

    const [transactions, total] =
      await this.payoutTransactionRepository.findAndCount({
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

  // Helper: Ensure profile row exists
  private async getOrCreateProfile(
    merchantId: string,
  ): Promise<MerchantProfile> {
    let profile = await this.profileRepo.findOne({
      where: { merchant_id: merchantId },
    });
    if (!profile) {
      profile = this.profileRepo.create({ merchant_id: merchantId });
      await this.profileRepo.save(profile);
    }
    return profile;
  }

  // --- API 1: Get All Settings ---
  async getSettings(merchantId: string) {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
      relations: ['user', 'merchant_profile'],
    });

    if (!merchant) throw new NotFoundException('Merchant not found');

    const defaultStore = await this.storeRepo.findOne({
      where: { merchant_id: merchantId, is_default: true },
    });

    return {
      // Profile Tab
      profile_img_url: merchant.merchant_profile?.profile_img_url || null,
      business_name: defaultStore?.business_name || '',
      contact_person_name: merchant.user.full_name,
      contact_number: merchant.user.phone,
      contact_email: merchant.user.email,

      // Documents Tab
      documents: {
        nid: {
          number: merchant.merchant_profile?.nid_number,
          front: merchant.merchant_profile?.nid_front_url,
          back: merchant.merchant_profile?.nid_back_url,
        },
        trade_license: {
          number: merchant.merchant_profile?.trade_license_number,
          url: merchant.merchant_profile?.trade_license_url,
        },
        tin: {
          number: merchant.merchant_profile?.tin_number,
          url: merchant.merchant_profile?.tin_certificate_url,
        },
        bin: {
          number: merchant.merchant_profile?.bin_number,
          url: merchant.merchant_profile?.bin_certificate_url,
        },
      },
    };
  }

  // --- API 2: Update Profile Details (Tab 1) ---
  async updateProfileDetails(merchantId: string, dto: UpdateProfileDetailsDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Fetch Merchant & User
      const merchant = await this.merchantRepository.findOne({
        where: { id: merchantId },
        relations: ['user'],
      });
      if (!merchant) throw new NotFoundException('Merchant user not found');

      // 2. Fetch Default Store
      const defaultStore = await this.storeRepo.findOne({
        where: { merchant_id: merchantId, is_default: true },
      });

      // 3. Update User (Contact Info)
      if (dto.contact_person_name || dto.contact_number) {
        if (dto.contact_person_name)
          merchant.user.full_name = dto.contact_person_name;
        if (dto.contact_number) merchant.user.phone = dto.contact_number;
        await queryRunner.manager.save(merchant.user);
      }

      // 4. Update Store (Business Name)
      if (dto.business_name) {
        if (!defaultStore)
          throw new BadRequestException('Default store not found');
        defaultStore.business_name = dto.business_name;
        await queryRunner.manager.save(defaultStore);
      }

      // 5. Update Profile (Image)
      if (dto.profile_img_url) {
        // We can't use getOrCreateProfile here easily because we are inside a transaction
        // So we manually check using the transaction manager
        let profile = await queryRunner.manager.findOne(MerchantProfile, {
          where: { merchant_id: merchantId },
        });

        if (!profile) {
          profile = queryRunner.manager.create(MerchantProfile, {
            merchant_id: merchantId,
          });
        }

        profile.profile_img_url = dto.profile_img_url;
        await queryRunner.manager.save(profile);
      }

      await queryRunner.commitTransaction();
      return { success: true, message: 'Profile details updated' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // --- API 3: Update NID ---
  async updateNid(merchantId: string, dto: UpdateNidDto) {
    const profile = await this.getOrCreateProfile(merchantId);
    profile.nid_number = dto.nid_number;
    profile.nid_front_url = dto.nid_front_url;
    profile.nid_back_url = dto.nid_back_url;
    return this.profileRepo.save(profile);
  }

  // --- API 4: Update Trade License ---
  async updateTradeLicense(merchantId: string, dto: UpdateTradeLicenseDto) {
    const profile = await this.getOrCreateProfile(merchantId);
    profile.trade_license_number = dto.trade_license_number;
    profile.trade_license_url = dto.trade_license_url;
    return this.profileRepo.save(profile);
  }

  // --- API 5: Update TIN ---
  async updateTin(merchantId: string, dto: UpdateTinDto) {
    const profile = await this.getOrCreateProfile(merchantId);
    profile.tin_number = dto.tin_number;
    profile.tin_certificate_url = dto.tin_certificate_url;
    return this.profileRepo.save(profile);
  }

  // --- API 6: Update BIN ---
  async updateBin(merchantId: string, dto: UpdateBinDto) {
    const profile = await this.getOrCreateProfile(merchantId);
    profile.bin_number = dto.bin_number;
    profile.bin_certificate_url = dto.bin_certificate_url;
    return this.profileRepo.save(profile);
  }
}
