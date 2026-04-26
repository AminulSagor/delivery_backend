import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
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
import { Store, StoreStatus } from 'src/stores/entities/store.entity';
import { Parcel, ParcelStatus } from '../parcels/entities/parcel.entity';
import { toParcelListItem } from '../common/interfaces/responses.interface';
import {
  UpdateBinDto,
  UpdateNidDto,
  UpdateProfileDetailsDto,
  UpdateTinDto,
  UpdateTradeLicenseDto,
} from './dto/update-profile-details.dto';
import { UpdateMerchantPasswordDto } from './dto/update-merchant-password.dto';
import { MerchantDashboardQueryDto } from './dto/merchant-dashboard-query.dto';
import { MerchantDeliveryPerformanceQueryDto } from './dto/merchant-delivery-performance-query.dto';

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
    @InjectRepository(Parcel)
    private parcelRepo: Repository<Parcel>,
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
      is_active: true, // Active immediately so merchant can login
    });

    // Create merchant
    const merchant = new Merchant();
    merchant.user_id = user.id;
    merchant.thana = dto.thana;
    merchant.district = dto.district;
    merchant.full_address = dto.full_address || dto.business_address;
    merchant.secondary_number = dto.secondary_number || null;
    merchant.status = MerchantStatus.PENDING;

    await this.merchantRepository.save(merchant);

    // === AUTO-CREATE DEFAULT STORE ===
    const storeCode = await this.generateStoreCode(dto.business_name);

    // Convert phone from +8801... to 01... format for store
    const storePhone = dto.phone.replace('+88', '');

    const store = new Store();
    store.merchant_id = merchant.id;
    store.store_code = storeCode;
    store.business_name = dto.business_name;
    store.business_address = dto.business_address;
    store.district = dto.district;
    store.thana = dto.thana;
    store.area = dto.area || null;
    store.phone_number = storePhone;
    store.email = dto.email || null;
    store.is_default = true; // First store is default
    store.status = StoreStatus.PENDING; // Requires admin approval
    store.carrybee_city_id = dto.carrybee_city_id;
    store.carrybee_zone_id = dto.carrybee_zone_id;
    store.carrybee_area_id = dto.carrybee_area_id;

    await this.storeRepo.save(store);

    console.log(
      `[MERCHANT SIGNUP] New merchant registered: ${user.full_name} (${user.phone}) - Status: PENDING`,
    );
    console.log(
      `[DEFAULT STORE CREATED] Store: ${store.business_name} (${store.store_code}) - Status: PENDING`,
    );

    return merchant;
  }

  /**
   * Generate unique store code from business name
   * Format: First 3 letters + 3 digit number (e.g., TSH001)
   */
  private async generateStoreCode(businessName: string): Promise<string> {
    // Extract first 3 letters from business name (uppercase)
    const prefix = businessName
      .replace(/[^A-Za-z]/g, '') // Remove non-letters
      .substring(0, 3)
      .toUpperCase()
      .padEnd(3, 'X'); // Ensure 3 characters

    // Find the highest number for this prefix
    const existingStores = await this.storeRepo
      .createQueryBuilder('store')
      .where('store.store_code LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('store.store_code', 'DESC')
      .getMany();

    let nextNumber = 1;
    if (existingStores.length > 0) {
      const lastCode = existingStores[0].store_code;
      if (lastCode) {
        const lastNumber = parseInt(lastCode.substring(3)) || 0;
        nextNumber = lastNumber + 1;
      }
    }

    // Format: PREFIX + 3-digit number (e.g., TSH001)
    return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
  }

  async setAdvancePaymentDisabled(
    merchantId: string,
    isDisabled: boolean,
    options?: { hubId?: string | null },
  ): Promise<Merchant> {
    // If Hub Manager is toggling, ensure merchant is assigned to that hub
    if (options?.hubId) {
      const storeCount = await this.storeRepo.count({
        where: { merchant_id: merchantId, hub_id: options.hubId },
      });

      if (storeCount === 0) {
        throw new ForbiddenException(
          'You do not have permission to update this merchant',
        );
      }
    }

    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    merchant.is_advance_payment_disabled = isDisabled;
    return await this.merchantRepository.save(merchant);
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
    search?: string;
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
      .leftJoinAndSelect('merchant.user', 'user')
      .leftJoin('stores', 'store', 'store.merchant_id = merchant.id');

    if (filters?.status) {
      query.andWhere('merchant.status = :status', { status: filters.status });
    }

    if (filters?.district) {
      query.andWhere('merchant.district ILIKE :district', {
        district: `%${filters.district}%`,
      });
    }

    if (filters?.search) {
      query.andWhere(
        '(user.full_name ILIKE :search OR user.phone ILIKE :search OR user.email ILIKE :search OR store.business_name ILIKE :search)',
        { search: `%${filters.search}%` },
      );
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

  /**
   * Admin: Get comprehensive merchant detail
   * Includes: personal info, documents, payout methods, all stores with performance, parcel stats
   */
  async findOneDetailed(id: string): Promise<any> {
    // 1. Load merchant with user, profile, approver
    const merchant = await this.merchantRepository.findOne({
      where: { id },
      relations: ['user', 'merchant_profile', 'approver'],
    });

    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${id} not found`);
    }

    // 2. Load all stores for this merchant (with hub relation)
    const stores = await this.storeRepo.find({
      where: { merchant_id: id },
      relations: ['hub', 'merchant', 'merchant.user'],
      order: { is_default: 'DESC', created_at: 'DESC' },
    });

    // 3. Calculate per-store performance stats
    let storeStats: any[] = [];
    if (stores.length > 0) {
      const storeIds = stores.map((s) => s.id);
      storeStats = await this.storeRepo.manager
        .createQueryBuilder(Parcel, 'parcel')
        .select('parcel.store_id', 'store_id')
        .addSelect('COUNT(parcel.id)', 'total_handled')
        .addSelect(
          `SUM(CASE WHEN parcel.status IN (:...deliveredStatuses) THEN 1 ELSE 0 END)`,
          'delivered_count',
        )
        .addSelect(
          `SUM(CASE WHEN parcel.status IN (:...returnStatuses) THEN 1 ELSE 0 END)`,
          'return_count',
        )
        .where('parcel.store_id IN (:...storeIds)', { storeIds })
        .groupBy('parcel.store_id')
        .setParameters({
          deliveredStatuses: [
            ParcelStatus.DELIVERED,
            ParcelStatus.PARTIAL_DELIVERY,
            ParcelStatus.EXCHANGE,
            ParcelStatus.PAID_RETURN,
          ],
          returnStatuses: [
            ParcelStatus.RETURNED,
            ParcelStatus.RETURNED_TO_HUB,
            ParcelStatus.RETURN_TO_MERCHANT,
            ParcelStatus.CANCELLED,
            ParcelStatus.FAILED_DELIVERY,
          ],
        })
        .getRawMany();
    }

    // Merge performance into stores
    const storesWithPerformance = stores.map((store) => {
      const stats = storeStats.find((s) => s.store_id === store.id) || {
        total_handled: '0',
        delivered_count: '0',
        return_count: '0',
      };
      return {
        ...store,
        performance: {
          total_parcels_handled: parseInt(stats.total_handled, 10),
          successfully_delivered: parseInt(stats.delivered_count, 10),
          total_returns: parseInt(stats.return_count, 10),
        },
      };
    });

    // 4. Load all payout methods
    const payoutMethods = await this.payoutMethodRepository.find({
      where: { merchant_id: id },
      order: { is_default: 'DESC', created_at: 'ASC' },
    });

    // 5. Aggregated parcel stats for this merchant
    const parcelStatsRaw = await this.parcelRepo
      .createQueryBuilder('parcel')
      .select('COUNT(parcel.id)', 'total_parcels')
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...deliveredStatuses) THEN 1 ELSE 0 END)`,
        'total_delivered',
      )
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...returnStatuses) THEN 1 ELSE 0 END)`,
        'total_returns',
      )
      .where('parcel.merchant_id = :merchantId', { merchantId: id })
      .setParameters({
        deliveredStatuses: [
          ParcelStatus.DELIVERED,
          ParcelStatus.PARTIAL_DELIVERY,
          ParcelStatus.EXCHANGE,
          ParcelStatus.PAID_RETURN,
        ],
        returnStatuses: [
          ParcelStatus.RETURNED,
          ParcelStatus.RETURNED_TO_HUB,
          ParcelStatus.RETURN_TO_MERCHANT,
          ParcelStatus.CANCELLED,
          ParcelStatus.FAILED_DELIVERY,
        ],
      })
      .getRawOne();

    return {
      merchant,
      stores: storesWithPerformance,
      payout_methods: payoutMethods,
      parcel_stats: {
        total_parcels: parseInt(parcelStatsRaw?.total_parcels || '0', 10),
        total_delivered: parseInt(parcelStatsRaw?.total_delivered || '0', 10),
        total_returns: parseInt(parcelStatsRaw?.total_returns || '0', 10),
      },
    };
  }

  async getMerchantOverview(
    merchantId: string,
    options: {
      hubId?: string | null;
      range?: 'last7d' | 'month';
      month?: string;
    },
  ) {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
      relations: ['user'],
    });

    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${merchantId} not found`);
    }

    const range: 'last7d' | 'month' =
      options.range === 'month' ? 'month' : 'last7d';
    const { start, end } = this.getDateRange(range, options.month);

    const storeScope: any = { merchant_id: merchantId };
    if (options.hubId) {
      storeScope.hub_id = options.hubId;
    }

    const storeCount = await this.storeRepo.count({ where: storeScope });

    if (options.hubId && storeCount === 0) {
      throw new ForbiddenException('Merchant has no stores in your hub');
    }

    const defaultStore =
      (await this.storeRepo.findOne({
        where: { ...storeScope, is_default: true },
        order: { created_at: 'ASC' },
      })) ||
      (await this.storeRepo.findOne({
        where: storeScope,
        order: { created_at: 'ASC' },
      }));

    const baseQb = this.parcelRepo
      .createQueryBuilder('parcel')
      .leftJoin('parcel.store', 'store')
      .where('parcel.merchant_id = :merchantId', { merchantId })
      .andWhere('parcel.created_at >= :start', { start })
      .andWhere('parcel.created_at < :end', { end });

    if (options.hubId) {
      baseQb.andWhere('store.hub_id = :hubId', { hubId: options.hubId });
    }

    const deliveredStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
    ];

    const returnedStatuses = [
      ParcelStatus.RETURNED,
      ParcelStatus.RETURN_TO_MERCHANT,
      ParcelStatus.RETURNED_TO_HUB,
      ParcelStatus.PAID_RETURN,
    ];

    const [
      totalParcels,
      deliveredParcels,
      returnedParcels,
      reportedParcels,
      graphRows,
      parcelsList,
    ] = await Promise.all([
      baseQb.clone().getCount(),
      baseQb
        .clone()
        .andWhere('parcel.status IN (:...deliveredStatuses)', {
          deliveredStatuses,
        })
        .getCount(),
      baseQb
        .clone()
        .andWhere('parcel.status IN (:...returnedStatuses)', {
          returnedStatuses,
        })
        .getCount(),
      baseQb
        .clone()
        .andWhere('parcel.issue_reported_at IS NOT NULL')
        .getCount(),
      baseQb
        .clone()
        .select("DATE_TRUNC('day', parcel.created_at)", 'bucket')
        .addSelect('COUNT(*)', 'count')
        .groupBy('bucket')
        .orderBy('bucket', 'ASC')
        .getRawMany(),
      baseQb
        .clone()
        .leftJoinAndSelect('parcel.store', 'parcelStore')
        .leftJoinAndSelect('parcel.merchant', 'parcelMerchant')
        .leftJoinAndSelect('parcelMerchant.user', 'parcelMerchantUser')
        .leftJoinAndSelect('parcel.customer', 'parcelCustomer')
        .leftJoinAndSelect('parcel.delivery_coverage_area', 'parcelArea')
        .leftJoinAndSelect('parcel.assignedRider', 'parcelRider')
        .leftJoinAndSelect('parcelRider.user', 'parcelRiderUser')
        .leftJoinAndSelect('parcel.currentHub', 'parcelCurrentHub')
        .leftJoinAndSelect('parcel.originHub', 'parcelOriginHub')
        .leftJoinAndSelect('parcel.destinationHub', 'parcelDestinationHub')
        .orderBy('parcel.created_at', 'DESC')
        .getMany(),
    ]);

    const graph = graphRows.map((row: any) => ({
      bucket: new Date(row.bucket).toISOString().substring(0, 10),
      count: Number(row.count),
    }));

    const parcels = (parcelsList || []).map((p) => toParcelListItem(p));

    return {
      merchant: {
        id: merchant.id,
        full_name: merchant.user?.full_name || null,
        phone: merchant.user?.phone || null,
        email: merchant.user?.email || null,
        business_name: defaultStore?.business_name || null,
        address:
          merchant.full_address || defaultStore?.business_address || null,
        status: merchant.status,
      },
      store_count: storeCount,
      parcel_totals: {
        total: totalParcels,
        delivered: deliveredParcels,
        returned: returnedParcels,
        reported: reportedParcels,
      },
      parcels,
      graph,
      range,
      range_start: start,
      range_end: end,
    };
  }

  async getMerchantDashboard(
    merchantId: string,
    query: MerchantDashboardQueryDto,
  ) {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    const assignedStatuses: ParcelStatus[] = [
      ParcelStatus.ASSIGNED_TO_RIDER,
      ParcelStatus.ASSIGNED_TO_THIRD_PARTY,
      ParcelStatus.OUT_FOR_DELIVERY,
    ];

    const returnedPerformanceStatuses = this.getReturnedPerformanceStatuses();

    const pendingDeliveryStatuses: ParcelStatus[] = [
      ParcelStatus.PENDING,
      ParcelStatus.PICKED_UP,
      ParcelStatus.IN_HUB,
      ParcelStatus.ASSIGNED_TO_RIDER,
      ParcelStatus.ASSIGNED_TO_THIRD_PARTY,
      ParcelStatus.OUT_FOR_DELIVERY,
      ParcelStatus.OUT_FOR_PICKUP,
      ParcelStatus.IN_TRANSIT,
      ParcelStatus.FAILED_DELIVERY,
      ParcelStatus.DELIVERY_RESCHEDULED,
    ];

    const todayRows = await this.parcelRepo
      .createQueryBuilder('parcel')
      .select('parcel.status', 'status')
      .addSelect('COUNT(parcel.id)', 'count')
      .addSelect('COALESCE(SUM(parcel.product_price), 0)', 'amount')
      .where('parcel.merchant_id = :merchantId', { merchantId })
      .andWhere('parcel.created_at >= :todayStart', { todayStart })
      .andWhere('parcel.created_at < :todayEnd', { todayEnd })
      .groupBy('parcel.status')
      .getRawMany();

    const todayByStatus = new Map<string, { count: number; amount: number }>();
    let newParcelsCount = 0;
    let newParcelsAmount = 0;

    for (const row of todayRows) {
      const count = this.toCount(row.count);
      const amount = this.toMoney(row.amount);

      todayByStatus.set(row.status, { count, amount });
      newParcelsCount += count;
      newParcelsAmount += amount;
    }

    const pickup = this.getStatusSummary(todayByStatus, [ParcelStatus.PICKED_UP]);
    const inTransit = this.getStatusSummary(todayByStatus, [
      ParcelStatus.IN_TRANSIT,
    ]);
    const assigned = this.getStatusSummary(todayByStatus, assignedStatuses);
    const delivered = this.getStatusSummary(todayByStatus, [
      ParcelStatus.DELIVERED,
    ]);
    const deliveryRescheduled = this.getStatusSummary(todayByStatus, [
      ParcelStatus.DELIVERY_RESCHEDULED,
    ]);

    const performanceRange = this.normalizePerformanceRange(
      query.performance_range,
    );
    const deliveryPerformance = await this.buildDeliveryPerformanceSummary(
      merchantId,
      performanceRange,
      todayStart,
      todayEnd,
    );
    const cashOnDeliveryDetails = await this.buildCashOnDeliveryDetails(
      merchantId,
      todayStart,
      todayEnd,
    );

    const lifetimeRange = this.resolveDashboardLifetimeRange(
      query.lifetime_start_date,
      query.lifetime_end_date,
    );

    const lifetimeSummaryQb = this.parcelRepo
      .createQueryBuilder('parcel')
      .select('COUNT(parcel.id)', 'total_count')
      .addSelect('COALESCE(SUM(parcel.product_price), 0)', 'total_amount')
      .addSelect(
        'SUM(CASE WHEN parcel.status = :deliveredStatus THEN 1 ELSE 0 END)',
        'delivered_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN parcel.status = :deliveredStatus THEN parcel.product_price ELSE 0 END), 0)',
        'delivered_amount',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status = :partialDeliveryStatus THEN 1 ELSE 0 END)',
        'partially_delivered_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN parcel.status = :partialDeliveryStatus THEN parcel.product_price ELSE 0 END), 0)',
        'partially_delivered_amount',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status = :paidReturnStatus THEN 1 ELSE 0 END)',
        'paid_return_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN parcel.status = :paidReturnStatus THEN parcel.product_price ELSE 0 END), 0)',
        'paid_return_amount',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status = :exchangeStatus THEN 1 ELSE 0 END)',
        'exchange_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN parcel.status = :exchangeStatus THEN parcel.product_price ELSE 0 END), 0)',
        'exchange_amount',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status IN (:...pendingDeliveryStatuses) THEN 1 ELSE 0 END)',
        'pending_delivery_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN parcel.status IN (:...pendingDeliveryStatuses) THEN parcel.product_price ELSE 0 END), 0)',
        'pending_delivery_amount',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status = :pendingReturnStatus THEN 1 ELSE 0 END)',
        'pending_return_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN parcel.status = :pendingReturnStatus THEN parcel.product_price ELSE 0 END), 0)',
        'pending_return_amount',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status = :returnToMerchantStatus THEN 1 ELSE 0 END)',
        'return_to_merchant_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN parcel.status = :returnToMerchantStatus THEN parcel.product_price ELSE 0 END), 0)',
        'return_to_merchant_amount',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status IN (:...returnPercentageStatuses) THEN 1 ELSE 0 END)',
        'return_percentage_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN parcel.status IN (:...returnPercentageStatuses) THEN parcel.product_price ELSE 0 END), 0)',
        'return_percentage_amount',
      )
      .where('parcel.merchant_id = :merchantId', { merchantId })
      .setParameters({
        deliveredStatus: ParcelStatus.DELIVERED,
        partialDeliveryStatus: ParcelStatus.PARTIAL_DELIVERY,
        paidReturnStatus: ParcelStatus.PAID_RETURN,
        exchangeStatus: ParcelStatus.EXCHANGE,
        pendingReturnStatus: ParcelStatus.RETURNED_TO_HUB,
        returnToMerchantStatus: ParcelStatus.RETURN_TO_MERCHANT,
        pendingDeliveryStatuses,
        returnPercentageStatuses: returnedPerformanceStatuses,
      });

    if (lifetimeRange.start && lifetimeRange.endExclusive) {
      lifetimeSummaryQb
        .andWhere('parcel.created_at >= :lifetimeStart', {
          lifetimeStart: lifetimeRange.start,
        })
        .andWhere('parcel.created_at < :lifetimeEndExclusive', {
          lifetimeEndExclusive: lifetimeRange.endExclusive,
        });
    }

    const lifetimeRaw = await lifetimeSummaryQb.getRawOne();

    const lifetimeTotalCount = this.toCount(lifetimeRaw?.total_count);
    const returnPercentageCount = this.toCount(lifetimeRaw?.return_percentage_count);
    const returnPercentage =
      lifetimeTotalCount > 0
        ? Number(((returnPercentageCount / lifetimeTotalCount) * 100).toFixed(2))
        : 0;

    return {
      generated_at: new Date().toISOString(),
      date_context: {
        timezone: 'UTC',
        today_start: todayStart.toISOString(),
        today_end: todayEnd.toISOString(),
      },
      summary_for_todays_parcel: {
        new_parcels: {
          count: newParcelsCount,
          amount: this.toMoney(newParcelsAmount),
        },
        pick_up: pickup,
        in_transit: inTransit,
        assigned,
        delivered,
        delivery_on_reschedule: deliveryRescheduled,
      },
      delivery_performance: deliveryPerformance,
      cash_on_delivery_details: cashOnDeliveryDetails,
      summary_for_lifetime_parcel: {
        date_range: {
          start_date: lifetimeRange.startDate,
          end_date: lifetimeRange.endDate,
        },
        total_parcel: {
          count: lifetimeTotalCount,
          amount: this.toMoney(lifetimeRaw?.total_amount),
        },
        delivered: {
          count: this.toCount(lifetimeRaw?.delivered_count),
          amount: this.toMoney(lifetimeRaw?.delivered_amount),
        },
        partially_delivered: {
          count: this.toCount(lifetimeRaw?.partially_delivered_count),
          amount: this.toMoney(lifetimeRaw?.partially_delivered_amount),
        },
        paid_return: {
          count: this.toCount(lifetimeRaw?.paid_return_count),
          amount: this.toMoney(lifetimeRaw?.paid_return_amount),
        },
        exchange: {
          count: this.toCount(lifetimeRaw?.exchange_count),
          amount: this.toMoney(lifetimeRaw?.exchange_amount),
        },
        pending_delivery: {
          count: this.toCount(lifetimeRaw?.pending_delivery_count),
          amount: this.toMoney(lifetimeRaw?.pending_delivery_amount),
        },
        return_percentage: {
          percentage: returnPercentage,
          count: returnPercentageCount,
          amount: this.toMoney(lifetimeRaw?.return_percentage_amount),
        },
        pending_return: {
          count: this.toCount(lifetimeRaw?.pending_return_count),
          amount: this.toMoney(lifetimeRaw?.pending_return_amount),
        },
        return_to_merchant: {
          count: this.toCount(lifetimeRaw?.return_to_merchant_count),
          amount: this.toMoney(lifetimeRaw?.return_to_merchant_amount),
        },
      },
    };
  }

  async getMerchantCashOnDeliveryDetails(merchantId: string) {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    return this.buildCashOnDeliveryDetails(merchantId, todayStart, todayEnd);
  }

  async getMerchantDeliveryPerformance(
    merchantId: string,
    query: MerchantDeliveryPerformanceQueryDto,
  ) {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    const performanceRange = this.normalizePerformanceRange(
      query.performance_range,
    );

    if (query.month && performanceRange !== 'monthly') {
      throw new BadRequestException(
        'month filter is only supported when performance_range is monthly',
      );
    }

    if (performanceRange === 'monthly' && query.month) {
      const monthRange = this.resolvePerformanceMonthRange(query.month);
      return this.buildDeliveryPerformanceSummaryByWindow(
        merchantId,
        performanceRange,
        monthRange.start,
        monthRange.endExclusive,
      );
    }

    return this.buildDeliveryPerformanceSummary(
      merchantId,
      performanceRange,
      todayStart,
      todayEnd,
    );
  }

  private async buildCashOnDeliveryDetails(
    merchantId: string,
    todayStart: Date,
    todayEnd: Date,
  ) {
    const codRaw = await this.parcelRepo
      .createQueryBuilder('parcel')
      .select('COALESCE(SUM(parcel.cod_collected_amount), 0)', 'total_collected')
      .addSelect('COALESCE(SUM(parcel.cod_amount), 0)', 'total_cod_amount')
      .addSelect(
        'COALESCE(SUM(GREATEST(parcel.cod_amount - parcel.cod_collected_amount, 0)), 0)',
        'total_pending',
      )
      .addSelect('COALESCE(SUM(parcel.delivery_charge), 0)', 'total_delivery_charge')
      .addSelect('COALESCE(SUM(parcel.weight_charge), 0)', 'total_weight_charge')
      .addSelect('COALESCE(SUM(parcel.cod_charge), 0)', 'total_cod_charge')
      .addSelect('COALESCE(SUM(parcel.return_charge), 0)', 'total_return_charge')
      .addSelect(
        'COALESCE(SUM(parcel.total_charge + COALESCE(parcel.return_charge, 0)), 0)',
        'total_fee',
      )
      .where('parcel.merchant_id = :merchantId', { merchantId })
      .andWhere('parcel.is_cod = true')
      .andWhere('parcel.status != :cancelledStatus', {
        cancelledStatus: ParcelStatus.CANCELLED,
      })
      .getRawOne();

    const todayCollectionRaw = await this.parcelRepo
      .createQueryBuilder('parcel')
      .select('COALESCE(SUM(parcel.cod_collected_amount), 0)', 'todays_collection')
      .where('parcel.merchant_id = :merchantId', { merchantId })
      .andWhere('parcel.is_cod = true')
      .andWhere('parcel.cod_collected_amount > 0')
      .andWhere('parcel.delivered_at >= :todayStart', { todayStart })
      .andWhere('parcel.delivered_at < :todayEnd', { todayEnd })
      .andWhere('parcel.status != :cancelledStatus', {
        cancelledStatus: ParcelStatus.CANCELLED,
      })
      .getRawOne();

    const totalCollected = this.toMoney(codRaw?.total_collected);
    const totalPending = this.toMoney(codRaw?.total_pending);
    const totalCodAmount = this.toMoney(codRaw?.total_cod_amount);
    const totalDeliveryCharge = this.toMoney(codRaw?.total_delivery_charge);
    const totalWeightCharge = this.toMoney(codRaw?.total_weight_charge);
    const totalCodCharge = this.toMoney(codRaw?.total_cod_charge);
    const totalReturnCharge = this.toMoney(codRaw?.total_return_charge);
    const totalFee = this.toMoney(codRaw?.total_fee);
    const todaysCollection = this.toMoney(todayCollectionRaw?.todays_collection);
    const totalReceivable = this.toMoney(totalCodAmount - totalFee);

    return {
      collection_status: {
        total_collected: totalCollected,
        total_pending: totalPending,
      },
      total_cash_on_delivery_amount: totalCodAmount,
      todays_collection: todaysCollection,
      total_fee: totalFee,
      total_receivable: totalReceivable,
      fee_breakdown: {
        total_delivery_charge: totalDeliveryCharge,
        total_weight_charge: totalWeightCharge,
        total_cod_charge: totalCodCharge,
        total_return_charge: totalReturnCharge,
      },
    };
  }

  private normalizePerformanceRange(
    range?: 'weekly' | 'monthly',
  ): 'weekly' | 'monthly' {
    return range === 'monthly' ? 'monthly' : 'weekly';
  }

  private getDeliveredPerformanceStatuses(): ParcelStatus[] {
    return [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
    ];
  }

  private getReturnedPerformanceStatuses(): ParcelStatus[] {
    return [
      ParcelStatus.RETURNED,
      ParcelStatus.PAID_RETURN,
      ParcelStatus.RETURN_TO_MERCHANT,
      ParcelStatus.RETURNED_TO_HUB,
    ];
  }

  private async buildDeliveryPerformanceSummary(
    merchantId: string,
    performanceRange: 'weekly' | 'monthly',
    todayStart: Date,
    todayEnd: Date,
  ) {
    const performanceDays = performanceRange === 'monthly' ? 30 : 7;

    const performanceStart = new Date(todayStart);
    performanceStart.setUTCDate(performanceStart.getUTCDate() - (performanceDays - 1));
    return this.buildDeliveryPerformanceSummaryByWindow(
      merchantId,
      performanceRange,
      performanceStart,
      todayEnd,
    );
  }

  private async buildDeliveryPerformanceSummaryByWindow(
    merchantId: string,
    performanceRange: 'weekly' | 'monthly',
    rangeStart: Date,
    rangeEndExclusive: Date,
  ) {
    const totalDays = Math.max(
      1,
      Math.floor(
        (rangeEndExclusive.getTime() - rangeStart.getTime()) /
          (24 * 60 * 60 * 1000),
      ),
    );

    const deliveredPerformanceStatuses = this.getDeliveredPerformanceStatuses();
    const returnedPerformanceStatuses = this.getReturnedPerformanceStatuses();

    const performanceRows = await this.parcelRepo
      .createQueryBuilder('parcel')
      .select("DATE_TRUNC('day', parcel.created_at)", 'bucket')
      .addSelect('COUNT(parcel.id)', 'total_count')
      .addSelect(
        'SUM(CASE WHEN parcel.status IN (:...deliveredPerformanceStatuses) THEN 1 ELSE 0 END)',
        'delivered_count',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status IN (:...returnedPerformanceStatuses) THEN 1 ELSE 0 END)',
        'returned_count',
      )
      .where('parcel.merchant_id = :merchantId', { merchantId })
      .andWhere('parcel.created_at >= :rangeStart', { rangeStart })
      .andWhere('parcel.created_at < :rangeEndExclusive', { rangeEndExclusive })
      .setParameters({
        deliveredPerformanceStatuses,
        returnedPerformanceStatuses,
      })
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany();

    const performanceByDate = new Map<
      string,
      { delivered: number; returned: number; total_parcel: number }
    >();

    for (const row of performanceRows) {
      const date = new Date(row.bucket).toISOString().substring(0, 10);
      performanceByDate.set(date, {
        delivered: this.toCount(row.delivered_count),
        returned: this.toCount(row.returned_count),
        total_parcel: this.toCount(row.total_count),
      });
    }

    const trend: Array<{
      day: string;
      date: string;
      delivered: number;
      returned: number;
      total_parcel: number;
    }> = [];

    for (let i = 0; i < totalDays; i++) {
      const bucketDate = new Date(rangeStart);
      bucketDate.setUTCDate(rangeStart.getUTCDate() + i);

      const date = bucketDate.toISOString().substring(0, 10);
      const day = bucketDate.toLocaleDateString('en-US', {
        weekday: 'short',
        timeZone: 'UTC',
      });

      const metrics = performanceByDate.get(date) || {
        delivered: 0,
        returned: 0,
        total_parcel: 0,
      };

      trend.push({
        day,
        date,
        delivered: metrics.delivered,
        returned: metrics.returned,
        total_parcel: metrics.total_parcel,
      });
    }

    const totals = trend.reduce(
      (acc, item) => {
        acc.delivered += item.delivered;
        acc.returned += item.returned;
        acc.total_parcel += item.total_parcel;
        return acc;
      },
      { delivered: 0, returned: 0, total_parcel: 0 },
    );

    return {
      range: performanceRange,
      start_date: rangeStart.toISOString().substring(0, 10),
      end_date: new Date(rangeEndExclusive.getTime() - 1)
        .toISOString()
        .substring(0, 10),
      totals,
      trend,
    };
  }

  private resolvePerformanceMonthRange(month: string): {
    start: Date;
    endExclusive: Date;
  } {
    const normalizedMonth = month.trim().toLowerCase();
    const yearMonthMatch = normalizedMonth.match(/^(\d{4})-(0[1-9]|1[0-2])$/);

    let year: number;
    let monthIndex: number | undefined;

    if (yearMonthMatch) {
      year = Number(yearMonthMatch[1]);
      monthIndex = Number(yearMonthMatch[2]) - 1;
    } else {
      const monthNameMap: Record<string, number> = {
        jan: 0,
        january: 0,
        feb: 1,
        february: 1,
        mar: 2,
        march: 2,
        apr: 3,
        april: 3,
        may: 4,
        jun: 5,
        june: 5,
        jul: 6,
        july: 6,
        aug: 7,
        august: 7,
        sep: 8,
        sept: 8,
        september: 8,
        oct: 9,
        october: 9,
        nov: 10,
        november: 10,
        dec: 11,
        december: 11,
      };

      monthIndex = monthNameMap[normalizedMonth];
      if (monthIndex === undefined) {
        throw new BadRequestException(
          'month must be in YYYY-MM format or month name like april',
        );
      }

      year = new Date().getUTCFullYear();
    }

    const start = new Date(Date.UTC(year, monthIndex, 1));
    const endExclusive = new Date(Date.UTC(year, monthIndex + 1, 1));

    return {
      start,
      endExclusive,
    };
  }

  private getStatusSummary(
    statusMap: Map<string, { count: number; amount: number }>,
    statuses: ParcelStatus[],
  ) {
    const summary = statuses.reduce(
      (acc, status) => {
        const item = statusMap.get(status);
        if (!item) {
          return acc;
        }

        acc.count += item.count;
        acc.amount += item.amount;
        return acc;
      },
      { count: 0, amount: 0 },
    );

    return {
      count: summary.count,
      amount: this.toMoney(summary.amount),
    };
  }

  private resolveDashboardLifetimeRange(
    startDate?: string,
    endDate?: string,
  ): {
    start: Date | null;
    endExclusive: Date | null;
    startDate: string | null;
    endDate: string | null;
  } {
    if ((startDate && !endDate) || (!startDate && endDate)) {
      throw new BadRequestException(
        'lifetime_start_date and lifetime_end_date must be provided together',
      );
    }

    if (!startDate || !endDate) {
      return {
        start: null,
        endExclusive: null,
        startDate: null,
        endDate: null,
      };
    }

    const start = this.parseDateOnlyAsUtc(startDate, 'lifetime_start_date');
    const end = this.parseDateOnlyAsUtc(endDate, 'lifetime_end_date');

    if (start > end) {
      throw new BadRequestException(
        'lifetime_start_date must be less than or equal to lifetime_end_date',
      );
    }

    const endExclusive = new Date(end);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

    return {
      start,
      endExclusive,
      startDate,
      endDate,
    };
  }

  private parseDateOnlyAsUtc(value: string, fieldName: string): Date {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new BadRequestException(`${fieldName} must be in YYYY-MM-DD format`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    // Guard against invalid calendar dates (e.g. 2026-02-30).
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${fieldName} is not a valid calendar date`);
    }

    return parsed;
  }

  private toCount(value: unknown): number {
    return Number(value || 0);
  }

  private toMoney(value: unknown): number {
    const parsed = Number(value || 0);
    return Math.round((parsed + Number.EPSILON) * 100) / 100;
  }

  async findMerchantsAssignedToHub(
    hubId: string,
    search?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Merchant[]; total: number }> {
    const skip = (page - 1) * limit;

    const qb = this.merchantRepository
      .createQueryBuilder('merchant')
      .leftJoinAndSelect('merchant.user', 'user')
      .innerJoin(
        'stores',
        'store',
        'store.merchant_id = merchant.id AND store.hub_id = :hubId',
        {
          hubId,
        },
      )
      .groupBy('merchant.id')
      .addGroupBy('user.id');

    if (search) {
      qb.andWhere(
        '(user.full_name ILIKE :search OR user.phone ILIKE :search OR user.email ILIKE :search OR store.business_name ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    qb.orderBy('merchant.created_at', 'DESC');

    const total = await qb.getCount();
    const merchants = await qb.offset(skip).limit(limit).getMany();

    return { data: merchants, total };
  }

  async getHubParcelsInHubStatus(merchantId: string, hubId: string) {
    const storeCount = await this.storeRepo.count({
      where: { merchant_id: merchantId, hub_id: hubId },
    });

    if (storeCount === 0) {
      throw new ForbiddenException('Merchant has no stores in your hub');
    }

    const parcels = await this.parcelRepo.find({
      where: {
        merchant_id: merchantId,
        status: In([ParcelStatus.IN_HUB, ParcelStatus.RETURNED_TO_HUB]),
      },
      relations: [
        'merchant',
        'merchant.user',
        'store',
        'store.hub',
        'store.merchant',
        'store.merchant.user',
        'delivery_coverage_area',
        'customer',
        'assignedRider',
        'assignedRider.user',
        'assignedRider.hub',
        'currentHub',
        'originHub',
        'destinationHub',
        'thirdPartyProvider',
      ],
      order: { created_at: 'DESC' },
    });

    // Restrict to parcels whose store is in the hub to avoid leakage
    const scopedParcels = parcels.filter((p) => p.store?.hub_id === hubId);

    return scopedParcels.map(toParcelListItem);
  }

  async update(id: string, dto: UpdateMerchantDto): Promise<Merchant> {
    const merchant = await this.merchantRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${id} not found`);
    }

    // === Update basic merchant fields ===
    if (dto.fullAddress !== undefined) merchant.full_address = dto.fullAddress;
    if (dto.secondaryNumber !== undefined) merchant.secondary_number = dto.secondaryNumber;
    if (dto.thana !== undefined) merchant.thana = dto.thana;
    if (dto.district !== undefined) merchant.district = dto.district;

    await this.merchantRepository.save(merchant);

    // === Update document fields in merchant_profiles ===
    if (dto.nid_number !== undefined || dto.trade_license_number !== undefined || dto.bin_number !== undefined) {
      const profile = await this.getOrCreateProfile(id);

      if (dto.nid_number !== undefined) {
        profile.nid_number = dto.nid_number;
        profile.nid_verified = false; // Reset verification when number changes
      }
      if (dto.trade_license_number !== undefined) {
        profile.trade_license_number = dto.trade_license_number;
        profile.trade_license_verified = false; // Reset verification when number changes
      }
      if (dto.bin_number !== undefined) {
        profile.bin_number = dto.bin_number;
        profile.bin_verified = false; // Reset verification when number changes
      }

      await this.profileRepo.save(profile);
    }

    // === Update stores ===
    if (dto.stores && dto.stores.length > 0) {
      for (const storeDto of dto.stores) {
        const store = await this.storeRepo.findOne({
          where: { id: storeDto.id, merchant_id: id },
        });

        if (!store) {
          throw new NotFoundException(
            `Store with ID ${storeDto.id} not found or does not belong to this merchant`,
          );
        }

        if (storeDto.business_name !== undefined) store.business_name = storeDto.business_name;
        if (storeDto.business_address !== undefined) store.business_address = storeDto.business_address;
        if (storeDto.phone_number !== undefined) store.phone_number = storeDto.phone_number;
        if (storeDto.email !== undefined) store.email = storeDto.email || null;
        if (storeDto.district !== undefined) store.district = storeDto.district || null;
        if (storeDto.thana !== undefined) store.thana = storeDto.thana || null;
        if (storeDto.area !== undefined) store.area = storeDto.area || null;
        if (storeDto.facebook_page !== undefined) store.facebook_page = storeDto.facebook_page || null;

        await this.storeRepo.save(store);
      }
    }

    console.log(`[MERCHANT UPDATED] Merchant ${id} updated by admin`);

    return merchant;
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

  private getDateRange(range: 'last7d' | 'month', month?: string) {
    if (range === 'month') {
      const monthString =
        month ||
        `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
      const [yearStr, monthStr] = monthString.split('-');
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;

      if (!year || monthIndex < 0 || monthIndex > 11) {
        throw new BadRequestException('month must be in YYYY-MM format');
      }

      const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));

      return { start, end };
    }

    const todayUtc = new Date();
    const end = new Date(
      Date.UTC(
        todayUtc.getUTCFullYear(),
        todayUtc.getUTCMonth(),
        todayUtc.getUTCDate() + 1,
      ),
    );
    const start = new Date(
      Date.UTC(
        todayUtc.getUTCFullYear(),
        todayUtc.getUTCMonth(),
        todayUtc.getUTCDate() - 6,
      ),
    );

    return { start, end };
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
      optional_phone_number: merchant.secondary_number,

      // Documents Tab
      documents: {
        nid: {
          number: merchant.merchant_profile?.nid_number,
          front: merchant.merchant_profile?.nid_front_url,
          back: merchant.merchant_profile?.nid_back_url,
          verified: merchant.merchant_profile?.nid_verified || false,
        },
        trade_license: {
          number: merchant.merchant_profile?.trade_license_number,
          url: merchant.merchant_profile?.trade_license_url,
          verified: merchant.merchant_profile?.trade_license_verified || false,
        },
        tin: {
          number: merchant.merchant_profile?.tin_number,
          url: merchant.merchant_profile?.tin_certificate_url,
          verified: merchant.merchant_profile?.tin_verified || false,
        },
        bin: {
          number: merchant.merchant_profile?.bin_number,
          url: merchant.merchant_profile?.bin_certificate_url,
          verified: merchant.merchant_profile?.bin_verified || false,
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

      if (
        dto.optional_phone_number &&
        dto.secondary_number &&
        dto.optional_phone_number !== dto.secondary_number
      ) {
        throw new BadRequestException(
          'Use either optional_phone_number or secondary_number with the same value',
        );
      }

      // 2. Fetch Default Store
      const defaultStore = await this.storeRepo.findOne({
        where: { merchant_id: merchantId, is_default: true },
      });

      // 3. Update User (Contact Info)
      if (
        dto.contact_person_name ||
        dto.contact_number ||
        dto.contact_email !== undefined
      ) {
        if (dto.contact_person_name)
          merchant.user.full_name = dto.contact_person_name;

        if (
          dto.contact_number &&
          dto.contact_number !== merchant.user.phone
        ) {
          const existingPhone = await this.userRepo.findOne({
            where: { phone: dto.contact_number },
          });

          if (existingPhone && existingPhone.id !== merchant.user.id) {
            throw new ConflictException('Phone number already registered');
          }

          merchant.user.phone = dto.contact_number;
        }

        if (
          dto.contact_email !== undefined &&
          dto.contact_email !== merchant.user.email
        ) {
          const existingEmail = await this.userRepo.findOne({
            where: { email: dto.contact_email },
          });

          if (existingEmail && existingEmail.id !== merchant.user.id) {
            throw new ConflictException('Email already registered');
          }

          merchant.user.email = dto.contact_email;
        }

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

      const optionalPhone = dto.optional_phone_number ?? dto.secondary_number;
      if (optionalPhone !== undefined) {
        merchant.secondary_number = optionalPhone;
        await queryRunner.manager.save(merchant);
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

  // --- API 7: Merchant Self Password Update ---
  async updateMyPassword(
    merchantId: string,
    dto: UpdateMerchantPasswordDto,
  ): Promise<void> {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
      relations: ['user'],
    });

    if (!merchant || !merchant.user) {
      throw new NotFoundException('Merchant user not found');
    }

    if (dto.new_password !== dto.confirm_new_password) {
      throw new BadRequestException(
        'New password and confirm password do not match',
      );
    }

    if (dto.current_password === dto.new_password) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const isCurrentPasswordValid = await this.usersService.comparePassword(
      dto.current_password,
      merchant.user.password_hash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    merchant.user.password_hash = await this.usersService.hashPassword(
      dto.new_password,
    );

    await this.userRepo.save(merchant.user);
  }

  // --- API 8: Get Merchants with Pending Documents (Admin) ---
  async findMerchantsWithPendingDocuments() {
    const merchants = await this.merchantRepository
      .createQueryBuilder('merchant')
      .leftJoinAndSelect('merchant.user', 'user')
      .leftJoinAndSelect('merchant.merchant_profile', 'profile')
      .where('profile.id IS NOT NULL')
      .andWhere(
        '(' +
          '(profile.nid_number IS NOT NULL AND profile.nid_verified = false) OR ' +
          '(profile.trade_license_number IS NOT NULL AND profile.trade_license_verified = false) OR ' +
          '(profile.tin_number IS NOT NULL AND profile.tin_verified = false) OR ' +
          '(profile.bin_number IS NOT NULL AND profile.bin_verified = false)' +
          ')',
      )
      .orderBy('merchant.created_at', 'DESC')
      .getMany();

    return merchants.map((merchant) => {
      const profile = merchant.merchant_profile;
      return {
        merchant_id: merchant.id,
        user_id: merchant.user_id,
        full_name: merchant.user?.full_name,
        phone: merchant.user?.phone,
        email: merchant.user?.email,
        merchant_status: merchant.status,
        documents: {
          nid: {
            uploaded: !!profile?.nid_number,
            number: profile?.nid_number || null,
            front_url: profile?.nid_front_url || null,
            back_url: profile?.nid_back_url || null,
            verified: profile?.nid_verified || false,
          },
          trade_license: {
            uploaded: !!profile?.trade_license_number,
            number: profile?.trade_license_number || null,
            url: profile?.trade_license_url || null,
            verified: profile?.trade_license_verified || false,
          },
          tin: {
            uploaded: !!profile?.tin_number,
            number: profile?.tin_number || null,
            url: profile?.tin_certificate_url || null,
            verified: profile?.tin_verified || false,
          },
          bin: {
            uploaded: !!profile?.bin_number,
            number: profile?.bin_number || null,
            url: profile?.bin_certificate_url || null,
            verified: profile?.bin_verified || false,
          },
        },
      };
    });
  }

  // --- API 9: Approve Individual Document (Admin) ---
  async approveDocument(
    merchantId: string,
    documentType: 'nid' | 'trade_license' | 'tin' | 'bin',
  ) {
    const profile = await this.profileRepo.findOne({
      where: { merchant_id: merchantId },
    });

    if (!profile) {
      throw new NotFoundException('Merchant profile not found');
    }

    const docFieldMap = {
      nid: { checkField: 'nid_number', verifiedField: 'nid_verified' },
      trade_license: {
        checkField: 'trade_license_number',
        verifiedField: 'trade_license_verified',
      },
      tin: { checkField: 'tin_number', verifiedField: 'tin_verified' },
      bin: { checkField: 'bin_number', verifiedField: 'bin_verified' },
    };

    const { checkField, verifiedField } = docFieldMap[documentType];

    if (!profile[checkField]) {
      throw new BadRequestException(
        `${documentType.toUpperCase()} document has not been uploaded yet`,
      );
    }

    if (profile[verifiedField]) {
      throw new BadRequestException(
        `${documentType.toUpperCase()} document is already verified`,
      );
    }

    profile[verifiedField] = true;
    await this.profileRepo.save(profile);

    return {
      merchant_id: merchantId,
      document_type: documentType,
      verified: true,
    };
  }

  /**
   * Get Merchant Lifetime Parcel Summary
   * Returns counts and total prices for each parcel status category
   */
  async getLifetimeParcelSummary(merchantId: string) {
    // Verify merchant exists
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    // Get all parcels for this merchant with their prices
    const parcels = await this.parcelRepo.find({
      where: { merchant_id: merchantId },
      select: ['id', 'status', 'product_price'],
    });

    // Initialize summary object
    const summary = {
      total_parcel: { count: 0, total_price: 0 },
      total_delivered: { count: 0, total_price: 0 },
      total_partially_delivered: { count: 0, total_price: 0 },
      total_paid_return: { count: 0, total_price: 0 },
      total_returned: { count: 0, total_price: 0 },
      total_pending_return: { count: 0, total_price: 0 },
      total_return_to_merchant: { count: 0, total_price: 0 },
      total_exchanged: { count: 0, total_price: 0 },
    };

    // Calculate totals
    parcels.forEach((parcel) => {
      const price = Number(parcel.product_price || 0);

      // Total Parcel
      summary.total_parcel.count++;
      summary.total_parcel.total_price += price;

      // Status-specific counts
      switch (parcel.status) {
        case ParcelStatus.DELIVERED:
          summary.total_delivered.count++;
          summary.total_delivered.total_price += price;
          break;

        case ParcelStatus.PARTIAL_DELIVERY:
          summary.total_partially_delivered.count++;
          summary.total_partially_delivered.total_price += price;
          break;

        case ParcelStatus.PAID_RETURN:
          summary.total_paid_return.count++;
          summary.total_paid_return.total_price += price;
          break;

        case ParcelStatus.RETURNED:
          summary.total_returned.count++;
          summary.total_returned.total_price += price;
          break;

        case ParcelStatus.RETURNED_TO_HUB:
          // Pending return (returned to hub but not yet to merchant)
          summary.total_pending_return.count++;
          summary.total_pending_return.total_price += price;
          break;

        case ParcelStatus.RETURN_TO_MERCHANT:
          summary.total_return_to_merchant.count++;
          summary.total_return_to_merchant.total_price += price;
          break;

        case ParcelStatus.EXCHANGE:
          summary.total_exchanged.count++;
          summary.total_exchanged.total_price += price;
          break;
      }
    });

    return summary;
  }

  /**
   * Deactivate merchant - sets both merchant user and merchant as inactive
   */
  async deactivate(id: string): Promise<Merchant> {
    const merchant = await this.findOne(id);

    // Deactivate the user account
    if (merchant.user) {
      merchant.user.is_active = false;
      await this.userRepo.save(merchant.user);
    }

    console.log(
      `[MERCHANT DEACTIVATED] Merchant deactivated: ${merchant.user?.full_name} (${merchant.id})`,
    );

    return merchant;
  }

  /**
   * Activate merchant - sets both merchant user and merchant as active
   */
  async activate(id: string): Promise<Merchant> {
    const merchant = await this.findOne(id);

    // Activate the user account
    if (merchant.user) {
      merchant.user.is_active = true;
      await this.userRepo.save(merchant.user);
    }

    console.log(
      `[MERCHANT ACTIVATED] Merchant activated: ${merchant.user?.full_name} (${merchant.id})`,
    );

    return merchant;
  }

  /**
   * Decline merchant - Permanent deactivation (sets status to REJECTED)
   */
  async decline(id: string): Promise<Merchant> {
    const merchant = await this.findOne(id);

    // Set merchant status to REJECTED (permanent)
    merchant.status = MerchantStatus.REJECTED;

    // Also deactivate user permanently
    if (merchant.user) {
      merchant.user.is_active = false;
      await this.userRepo.save(merchant.user);
    }

    console.log(
      `[MERCHANT DECLINED] Merchant permanently declined: ${merchant.user?.full_name} (${merchant.id})`,
    );

    return merchant;
  }
}
