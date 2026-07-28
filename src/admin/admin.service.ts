import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { MerchantPayoutMethod } from '../merchant/entities/merchant-payout-method.entity';
import { Parcel, ParcelStatus } from '../parcels/entities/parcel.entity';
import { HubTransferRecord } from '../hubs/entities/hub-transfer-record.entity';
import { Store } from '../stores/entities/store.entity';
import { Hub } from '../hubs/entities/hub.entity';
import { HubManager } from '../hubs/entities/hub-manager.entity';
import { HubManagerFinance } from '../hubs/entities/hub-manager-finance.entity';
import { HubExpense } from '../hubs/entities/hub-expense.entity';
import { Rider } from '../riders/entities/rider.entity';
import { UsersService } from '../users/users.service';
import { UserRole } from '../common/enums/user-role.enum';
import { TransferRecordStatus } from '../common/enums/transfer-record-status.enum';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AdminCreateMerchantDto } from './dto/admin-create-merchant.dto';
import { AddPayoutMethodDto } from '../merchant/dto/add-payout-method.dto';
import { UpdatePayoutMethodDto } from '../merchant/dto/update-payout-method.dto';
import { TransferRecordQueryDto } from '../hubs/dto/transfer-record-query.dto';
import { AdminParcelQueryDto } from './dto/admin-parcel-query.dto';
import { toParcelListItem } from '../common/interfaces/responses.interface';
import { MerchantService } from '../merchant/merchant.service';
import { PayoutMethodType } from '../common/enums/payout-method-type.enum';
import { ParcelsService } from '../parcels/parcels.service';
import { AdminCreateParcelDto } from '../parcels/dto/admin-create-parcel.dto';
import { PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Merchant)
    private merchantRepository: Repository<Merchant>,
    @InjectRepository(Parcel)
    private parcelRepository: Repository<Parcel>,
    @InjectRepository(HubTransferRecord)
    private hubTransferRecordRepository: Repository<HubTransferRecord>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(Hub)
    private hubRepository: Repository<Hub>,
    @InjectRepository(HubManager)
    private hubManagerRepository: Repository<HubManager>,
    @InjectRepository(HubManagerFinance)
    private hubManagerFinanceRepository: Repository<HubManagerFinance>,
    @InjectRepository(HubExpense)
    private hubExpenseRepository: Repository<HubExpense>,
    private usersService: UsersService,
    private merchantService: MerchantService,
    private parcelsService: ParcelsService,
  ) {}

  async create(dto: CreateAdminDto): Promise<User> {
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

    // Create admin user
    const admin = await this.usersService.create({
      full_name: dto.fullName,
      phone: dto.phone,
      email: dto.email || undefined,
      password_hash: passwordHash,
      role: UserRole.ADMIN,
      is_active: true,
    });

    console.log(
      `[ADMIN CREATED] New admin user: ${admin.full_name} (${admin.phone})`,
    );

    return admin;
  }

  // ===== MERCHANT MANAGEMENT =====

  /**
   * Admin creates a merchant (auto-approved, no PENDING state)
   */
  async adminCreateMerchant(
    dto: AdminCreateMerchantDto,
    adminId: string,
  ): Promise<Merchant> {
    return this.merchantService.adminCreateMerchant(dto, adminId);
  }

  /**
   * Admin: Get all payout methods for a merchant
   */
  async getMerchantPayoutMethods(
    merchantId: string,
  ): Promise<MerchantPayoutMethod[]> {
    return this.merchantService.getMerchantPayoutMethods(merchantId);
  }

  /**
   * Get all system-supported payout method types
   */
  getSystemPayoutMethodTypes(): PayoutMethodType[] {
    return Object.values(PayoutMethodType);
  }

  /**
   * Admin: Get payout transaction history for a merchant
   */
  async getMerchantPayoutTransactions(
    merchantId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    return this.merchantService.getPayoutTransactions(merchantId, page, limit);
  }

  /**
   * Admin: Add a payout method for a merchant (auto-verified — no pending step)
   */
  async adminAddPayoutMethod(
    merchantId: string,
    dto: AddPayoutMethodDto,
    adminId: string,
  ): Promise<MerchantPayoutMethod> {
    // Add the method (starts as PENDING)
    const method = await this.merchantService.addPayoutMethod(merchantId, dto);
    // Immediately verify it on behalf of admin
    return this.merchantService.verifyPayoutMethod(method.id, adminId);
  }

  /**
   * Admin: Update a payout method for a merchant
   */
  async adminUpdatePayoutMethod(
    merchantId: string,
    methodId: string,
    dto: UpdatePayoutMethodDto,
  ): Promise<MerchantPayoutMethod> {
    return this.merchantService.updatePayoutMethod(merchantId, methodId, dto);
  }

  /**
   * Admin: Set a payout method as default for a merchant
   */
  async adminSetDefaultPayoutMethod(
    merchantId: string,
    methodId: string,
  ): Promise<MerchantPayoutMethod> {
    return this.merchantService.setDefaultPayoutMethod(merchantId, methodId);
  }

  /**
   * Admin: Create and receive a parcel
   */
  async createAndReceiveParcel(dto: AdminCreateParcelDto, adminId: string) {
    return this.parcelsService.createByAdmin(dto, adminId);
  }

  /**
   * Admin: Get parcels eligible for receive across all hubs.
   * Eligible statuses: PENDING, PICKED_UP
   */
  async getParcelsForReceipt(
    query: AdminParcelQueryDto,
  ): Promise<PaginatedResponse<Parcel>> {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'created_at',
      order = 'DESC',
      hubId,
      merchantId,
      storeId,
      customerName,
      customerPhone,
      merchantName,
      minAmount,
      maxAmount,
      deliveryType,
    } = query;

    const skip = (page - 1) * limit;

    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.merchant', 'merchant')
      .leftJoinAndSelect('merchant.user', 'merchantUser')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('store.hub', 'storeHub')
      .leftJoinAndSelect('store.merchant', 'storeMerchant')
      .leftJoinAndSelect('storeMerchant.user', 'storeMerchantUser')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .leftJoinAndSelect('parcel.delivery_coverage_area', 'coverageArea')
      .leftJoinAndSelect('parcel.assignedRider', 'assignedRider')
      .leftJoinAndSelect('assignedRider.user', 'assignedRiderUser')
      .leftJoinAndSelect('assignedRider.hub', 'assignedRiderHub')
      .leftJoinAndSelect('parcel.currentHub', 'currentHub')
      .leftJoinAndSelect('parcel.originHub', 'originHub')
      .leftJoinAndSelect('parcel.destinationHub', 'destinationHub')
      .leftJoinAndSelect('parcel.thirdPartyProvider', 'thirdPartyProvider')
      .where('parcel.status IN (:...eligibleStatuses)', {
        eligibleStatuses: [ParcelStatus.PENDING, ParcelStatus.PICKED_UP],
      });

    if (hubId) {
      queryBuilder.andWhere('store.hub_id = :hubId', { hubId });
    }

    if (merchantId) {
      queryBuilder.andWhere('parcel.merchant_id = :merchantId', { merchantId });
    }

    if (storeId) {
      queryBuilder.andWhere('parcel.store_id = :storeId', { storeId });
    }

    if (customerName?.trim()) {
      queryBuilder.andWhere('parcel.customer_name ILIKE :customerName', {
        customerName: `%${customerName.trim()}%`,
      });
    }

    if (customerPhone?.trim()) {
      queryBuilder.andWhere('parcel.customer_phone ILIKE :customerPhone', {
        customerPhone: `%${customerPhone.trim()}%`,
      });
    }

    if (merchantName?.trim()) {
      queryBuilder.andWhere('merchantUser.full_name ILIKE :merchantName', {
        merchantName: `%${merchantName.trim()}%`,
      });
    }

    if (minAmount !== undefined) {
      queryBuilder.andWhere(
        'COALESCE(parcel.cod_amount, parcel.product_price, parcel.total_charge, 0) >= :minAmount',
        { minAmount },
      );
    }

    if (maxAmount !== undefined) {
      queryBuilder.andWhere(
        'COALESCE(parcel.cod_amount, parcel.product_price, parcel.total_charge, 0) <= :maxAmount',
        { maxAmount },
      );
    }

    if (deliveryType !== undefined) {
      queryBuilder.andWhere('parcel.delivery_type = :deliveryType', {
        deliveryType,
      });
    }

    if (search?.trim()) {
      const keyword = `%${search.trim()}%`;
      queryBuilder.andWhere(
        `(
          CAST(parcel.id AS TEXT) ILIKE :keyword OR
          parcel.tracking_number ILIKE :keyword OR
          parcel.parcel_tx_id ILIKE :keyword OR
          parcel.merchant_order_id ILIKE :keyword OR
          parcel.customer_name ILIKE :keyword OR
          parcel.customer_phone ILIKE :keyword OR
          merchantUser.full_name ILIKE :keyword OR
          store.business_name ILIKE :keyword OR
          coverageArea.area ILIKE :keyword OR
          coverageArea.zone ILIKE :keyword OR
          coverageArea.city ILIKE :keyword OR
          parcel.delivery_area ILIKE :keyword
        )`,
        { keyword },
      );
    }

    const sortFieldMap: Record<string, string> = {
      created_at: 'parcel.created_at',
      updated_at: 'parcel.updated_at',
      customer_name: 'parcel.customer_name',
      customer_phone: 'parcel.customer_phone',
      cod_amount: 'parcel.cod_amount',
      product_price: 'parcel.product_price',
      total_charge: 'parcel.total_charge',
      status: 'parcel.status',
      delivery_type: 'parcel.delivery_type',
      merchant_name: 'merchantUser.full_name',
      store_name: 'store.business_name',
      tracking_number: 'parcel.tracking_number',
      parcel_tx_id: 'parcel.parcel_tx_id',
    };

    const sortField = sortFieldMap[sortBy] || 'parcel.created_at';
    queryBuilder.orderBy(
      sortField,
      order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
    );

    queryBuilder.skip(skip).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Admin: Bulk receive parcels on behalf of the parcel's assigned store hub.
   */
  async bulkReceiveParcels(parcelIds: string[]): Promise<{
    success: number;
    failed: number;
    results: Array<{
      parcel_id: string;
      parcel_tx_id?: string | null;
      tracking_number?: string;
      success: boolean;
      error?: string;
      assignment_attempted?: boolean;
      carrybee_assigned?: boolean;
      carrybee_consignment_id?: string | null;
      carrybee_delivery_fee?: number | null;
      carrybee_cod_fee?: number | null;
      carrybee_error?: string | null;
    }>;
  }> {
    const results: Array<{
      parcel_id: string;
      parcel_tx_id?: string | null;
      tracking_number?: string;
      success: boolean;
      error?: string;
      assignment_attempted?: boolean;
      carrybee_assigned?: boolean;
      carrybee_consignment_id?: string | null;
      carrybee_delivery_fee?: number | null;
      carrybee_cod_fee?: number | null;
      carrybee_error?: string | null;
    }> = [];

    let successCount = 0;
    let failedCount = 0;

    const hubToParcelIds = new Map<string, string[]>();

    for (const parcelId of parcelIds) {
      const parcel = await this.parcelRepository.findOne({
        where: { id: parcelId },
        relations: ['store'],
      });

      if (!parcel) {
        results.push({
          parcel_id: parcelId,
          success: false,
          error: 'Parcel not found',
        });
        failedCount++;
        continue;
      }

      if (!parcel.store?.hub_id) {
        results.push({
          parcel_id: parcelId,
          parcel_tx_id: parcel.parcel_tx_id,
          tracking_number: parcel.tracking_number,
          success: false,
          error: 'Parcel store is not assigned to any hub',
        });
        failedCount++;
        continue;
      }

      const hubParcelIds = hubToParcelIds.get(parcel.store.hub_id) || [];
      hubParcelIds.push(parcelId);
      hubToParcelIds.set(parcel.store.hub_id, hubParcelIds);
    }

    for (const [hubId, ids] of hubToParcelIds.entries()) {
      const hubResult = await this.parcelsService.bulkMarkAsReceived(
        ids,
        hubId,
      );

      for (const item of hubResult.results) {
        if (item.success) {
          successCount++;
        } else {
          failedCount++;
        }
        results.push(item);
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      results,
    };
  }

  /**
   * Admin: Delete a payout method for a merchant
   */
  async adminDeletePayoutMethod(
    merchantId: string,
    methodId: string,
  ): Promise<void> {
    return this.merchantService.deletePayoutMethod(merchantId, methodId);
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      where: { role: UserRole.ADMIN },
      select: [
        'id',
        'full_name',
        'phone',
        'email',
        'role',
        'is_active',
        'created_at',
        'updated_at',
      ],
    });
  }

  async findOne(id: string): Promise<User> {
    const admin = await this.userRepository.findOne({
      where: { id, role: UserRole.ADMIN },
      select: [
        'id',
        'full_name',
        'phone',
        'email',
        'role',
        'is_active',
        'created_at',
        'updated_at',
      ],
    });

    if (!admin) {
      throw new NotFoundException(`Admin with ID ${id} not found`);
    }

    return admin;
  }

  async update(id: string, dto: UpdateAdminDto): Promise<User> {
    const admin = await this.findOne(id);

    // Update allowed fields
    if (dto.fullName) admin.full_name = dto.fullName;
    if (dto.email) admin.email = dto.email;
    if (dto.phone) admin.phone = dto.phone;

    // Update password if provided
    if (dto.password) {
      admin.password_hash = await this.usersService.hashPassword(dto.password);
    }

    await this.userRepository.save(admin);

    console.log(
      `[ADMIN UPDATED] Admin user updated: ${admin.full_name} (${admin.id})`,
    );

    return admin;
  }

  async remove(id: string): Promise<void> {
    const admin = await this.findOne(id);

    // Prevent deleting the last admin
    const adminCount = await this.userRepository.count({
      where: { role: UserRole.ADMIN },
    });

    if (adminCount <= 1) {
      throw new ConflictException('Cannot delete the last admin user');
    }

    await this.userRepository.remove(admin);

    console.log(
      `[ADMIN DELETED] Admin user deleted: ${admin.full_name} (${admin.id})`,
    );
  }

  async deactivate(id: string): Promise<User> {
    const admin = await this.findOne(id);

    admin.is_active = false;
    await this.userRepository.save(admin);

    console.log(
      `[ADMIN DEACTIVATED] Admin user deactivated: ${admin.full_name} (${admin.id})`,
    );

    return admin;
  }

  async activate(id: string): Promise<User> {
    const admin = await this.findOne(id);

    admin.is_active = true;
    await this.userRepository.save(admin);

    console.log(
      `[ADMIN ACTIVATED] Admin user activated: ${admin.full_name} (${admin.id})`,
    );

    return admin;
  }

  /**
   * Admin: List hubs with finance summary for hub cash collection UI
   */
  async getHubCollections(query: {
    page?: number;
    limit?: number;
    search?: string;
    area?: string;
    sortBy?: string;
    order?: 'ASC' | 'DESC';
  }) {
    const {
      page = 1,
      limit = 20,
      search,
      area,
      sortBy = 'branch_name',
      order = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.hubRepository
      .createQueryBuilder('hub')
      .leftJoinAndSelect('hub.manager_user', 'managerUser');

    if (area?.trim()) {
      qb.andWhere('hub.area ILIKE :area', { area: `%${area.trim()}%` });
    }

    if (search?.trim()) {
      const kw = `%${search.trim()}%`;
      qb.andWhere(
        '(hub.branch_name ILIKE :kw OR hub.hub_code ILIKE :kw OR managerUser.full_name ILIKE :kw OR managerUser.phone ILIKE :kw)',
        { kw },
      );
    }

    const sortFieldMap: Record<string, string> = {
      branch_name: 'hub.branch_name',
      hub_code: 'hub.hub_code',
      area: 'hub.area',
      created_at: 'hub.created_at',
    };

    const sortField = sortFieldMap[sortBy] || 'hub.branch_name';
    qb.orderBy(sortField, order === 'ASC' ? 'ASC' : 'DESC');

    qb.skip(skip).take(limit);

    const [hubs, total] = await qb.getManyAndCount();

    const mapped = [] as any[];

    for (const hub of hubs) {
      // Find hub manager record
      const manager = await this.hubManagerRepository.findOne({
        where: { hub_id: hub.id },
        relations: ['user'],
      });

      // Finance snapshot
      const finance = await this.hubManagerFinanceRepository.findOne({
        where: { hub_id: hub.id },
      });

      // Lifetime expenses (APPROVED)
      const expenseResult = await this.hubExpenseRepository
        .createQueryBuilder('e')
        .select('COALESCE(SUM(e.amount), 0)', 'total')
        .where('e.hub_id = :hubId', { hubId: hub.id })
        .andWhere('e.status = :status', {
          status: TransferRecordStatus.APPROVED,
        })
        .getRawOne();

      // Pending transfers
      const pendingResult = await this.hubTransferRecordRepository
        .createQueryBuilder('t')
        .select('COALESCE(SUM(t.transferred_amount), 0)', 'total')
        .where('t.hub_id = :hubId', { hubId: hub.id })
        .andWhere('t.status IN (:...statuses)', {
          statuses: [
            TransferRecordStatus.PENDING,
            TransferRecordStatus.IN_REVIEW,
          ],
        })
        .getRawOne();

      mapped.push({
        id: hub.id,
        hub_code: hub.hub_code,
        branch_name: hub.branch_name,
        area: hub.area,
        address: hub.address,
        manager: manager?.user
          ? {
              id: manager.id,
              name: manager.user.full_name,
              phone: manager.user.phone,
            }
          : { name: hub.manager_name, phone: hub.manager_phone },
        lifetime_collection: Number(finance?.total_collected_from_riders || 0),
        hub_expenses: Number(expenseResult?.total || 0),
        pending_amount: Number(pendingResult?.total || 0),
        last_received_at: finance?.last_collection_at || null,
      });
    }

    return {
      items: mapped,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Admin: Notify a hub (placeholder - may integrate SMS/email later)
   */
  async notifyHub(hubId: string, message?: string) {
    const hub = await this.hubRepository.findOne({ where: { id: hubId } });
    if (!hub) throw new NotFoundException('Hub not found');

    // For now, just log and return timestamp. Integrate notification provider later.
    const notifiedAt = new Date();
    console.log(
      `[ADMIN NOTIFY HUB] Hub ${hub.branch_name} (${hub.id}) notified. Message: ${message || 'n/a'}`,
    );

    return {
      hub_id: hub.id,
      notified_at: notifiedAt,
      message: message || null,
    };
  }

  /**
   * Admin: Get hub detail with financial summary and related parcels
   */
  async getHubDetail(
    hubId: string,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      merchantId?: string;
      riderId?: string;
      sortBy?: string;
      order?: 'ASC' | 'DESC';
    } = {},
  ) {
    const hub = await this.hubRepository.findOne({
      where: { id: hubId },
      relations: ['manager_user'],
    });
    if (!hub) throw new NotFoundException('Hub not found');

    const manager = await this.hubManagerRepository.findOne({
      where: { hub_id: hubId },
      relations: ['user'],
    });

    const finance = await this.hubManagerFinanceRepository.findOne({
      where: { hub_id: hubId },
    });

    // Expenses
    const expenseResult = await this.hubExpenseRepository
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'total')
      .where('e.hub_id = :hubId', { hubId })
      .andWhere('e.status = :status', { status: TransferRecordStatus.APPROVED })
      .getRawOne();

    // Receivable = Total collected - Expenses
    const totalCollected = Number(finance?.total_collected_from_riders || 0);
    const expenses = Number(expenseResult?.total || 0);
    const receivable = totalCollected - expenses;

    const hubDetail = {
      id: hub.id,
      hub_code: hub.hub_code,
      branch_name: hub.branch_name,
      area: hub.area,
      address: hub.address,
      manager: manager?.user
        ? {
            id: manager.id,
            name: manager.user.full_name,
            phone: manager.user.phone,
            secondary_phone: manager.user.phone || hub.manager_phone,
          }
        : {
            name: hub.manager_name,
            phone: hub.manager_phone,
            secondary_phone: hub.manager_phone,
          },
      total_collected_amount: totalCollected,
      expenses_clearance: expenses,
      total_receivable_amount: receivable,
      last_received_at: finance?.last_collection_at || null,
    };

    // Get parcels
    const {
      page = 1,
      limit = 20,
      search,
      status,
      merchantId,
      riderId,
      sortBy = 'created_at',
      order = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.merchant', 'merchant')
      .leftJoinAndSelect('merchant.user', 'merchantUser')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('store.hub', 'storeHub')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .leftJoinAndSelect('parcel.delivery_coverage_area', 'coverageArea')
      .leftJoinAndSelect('parcel.assignedRider', 'assignedRider')
      .leftJoinAndSelect('assignedRider.user', 'riderUser')
      .where('(parcel.current_hub_id = :hubId OR store.hub_id = :hubId)', {
        hubId,
      });

    if (status) {
      qb.andWhere('parcel.status = :status', { status });
    }

    if (merchantId) {
      qb.andWhere('parcel.merchant_id = :merchantId', { merchantId });
    }

    if (riderId) {
      qb.andWhere('parcel.assigned_rider_id = :riderId', { riderId });
    }

    if (search?.trim()) {
      const kw = `%${search.trim()}%`;
      qb.andWhere(
        `(
          parcel.customer_name ILIKE :kw OR
          parcel.customer_phone ILIKE :kw OR
          parcel.parcel_tx_id ILIKE :kw OR
          CAST(parcel.id AS TEXT) ILIKE :kw OR
          merchantUser.full_name ILIKE :kw OR
          coverageArea.area ILIKE :kw
        )`,
        { kw },
      );
    }

    // Only include parcels that have been cleared with the hub (hub collected from rider)
    qb.andWhere('parcel.cod_cleared_at IS NOT NULL');

    const sortFieldMap: Record<string, string> = {
      created_at: 'parcel.created_at',
      updated_at: 'parcel.updated_at',
      customer_name: 'parcel.customer_name',
      amount: 'parcel.total_charge',
      status: 'parcel.status',
    };

    const sortField = sortFieldMap[sortBy] || 'parcel.created_at';
    qb.orderBy(sortField, order === 'ASC' ? 'ASC' : 'DESC');
    qb.skip(skip).take(limit);

    const [parcels, total] = await qb.getManyAndCount();

    const mappedParcels = parcels.map((p) => {
      const deliveryCharge = Number(p.delivery_charge || 0);
      const weightCharge = Number(p.weight_charge || 0);
      const codCharge = Number(p.cod_charge || 0);
      const totalCharge = Number(p.total_charge || 0);
      const discount = Math.max(
        0,
        Math.round(
          (deliveryCharge + weightCharge + codCharge - totalCharge) * 100,
        ) / 100,
      );

      return {
        id: p.id,
        parcel_id: p.parcel_tx_id || p.id,
        tracking_number: p.tracking_number,
        customer_name: p.customer_name,
        customer_phone: p.customer_phone,
        customer_secondary_phone: p.customer_secondary_phone || null,
        customer_address: p.customer_address,
        merchant_name: p.merchant?.user?.full_name || 'N/A',
        area: p.delivery_area || p.delivery_coverage_area?.area || 'N/A',
        rider_name: p.assignedRider?.user?.full_name || 'N/A',
        rider_phone: p.assignedRider?.user?.phone || null,
        status: p.status,
        amount: totalCharge,
        delivery_charge: deliveryCharge,
        cod_charge: codCharge,
        weight_charge: weightCharge,
        discount,
        age_days: Math.floor(
          (new Date().getTime() - p.created_at.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
        created_at: p.created_at,
        updated_at: p.updated_at,
      };
    });

    return {
      hub: hubDetail,
      parcels: {
        items: mappedParcels,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    };
  }

  // ===== DROPDOWN DATA METHODS =====

  /**
   * Get all stores for a specific merchant (for dropdowns)
   */
  async getMerchantStoresForDropdown(merchantId: string) {
    return this.storeRepository.find({
      where: { merchant_id: merchantId },
      select: ['id', 'business_name', 'store_code', 'hub_id'],
      order: { business_name: 'ASC' },
    });
  }

  // ===== HUB TRANSFER RECORDS =====

  // ===== HUB TRANSFER RECORDS =====

  /**
   * Get all hub transfer records (Admin)
   */
  async getAllHubTransferRecords(
    query: TransferRecordQueryDto,
  ): Promise<{ records: HubTransferRecord[]; total: number }> {
    const {
      status,
      hubId,
      hubManagerId,
      fromDate,
      toDate,
      page = 1,
      limit = 10,
    } = query;

    const queryBuilder = this.hubTransferRecordRepository
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.hubManager', 'hubManager')
      .leftJoinAndSelect('hubManager.user', 'hubManagerUser')
      .leftJoinAndSelect('transfer.hub', 'hub')
      .leftJoinAndSelect('transfer.reviewer', 'reviewer');

    if (status) {
      queryBuilder.andWhere('transfer.status = :status', { status });
    }

    if (hubId) {
      queryBuilder.andWhere('transfer.hub_id = :hubId', { hubId });
    }

    if (hubManagerId) {
      queryBuilder.andWhere('transfer.hub_manager_id = :hubManagerId', {
        hubManagerId,
      });
    }

    if (fromDate) {
      queryBuilder.andWhere('transfer.transfer_date >= :fromDate', {
        fromDate,
      });
    }

    if (toDate) {
      queryBuilder.andWhere('transfer.transfer_date <= :toDate', { toDate });
    }

    queryBuilder
      .orderBy('transfer.transfer_date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [records, total] = await queryBuilder.getManyAndCount();

    return { records, total };
  }

  /**
   * Approve transfer record
   */
  async approveTransferRecord(
    recordId: string,
    adminUserId: string,
    adminNotes?: string,
  ): Promise<HubTransferRecord> {
    const record = await this.hubTransferRecordRepository.findOne({
      where: { id: recordId },
      relations: ['hubManager', 'hubManager.user', 'hub'],
    });

    if (!record) {
      throw new NotFoundException('Transfer record not found');
    }

    if (record.status !== TransferRecordStatus.PENDING) {
      throw new BadRequestException('Only pending records can be approved');
    }

    record.status = TransferRecordStatus.APPROVED;
    record.reviewed_by = adminUserId;
    record.reviewed_at = new Date();
    record.admin_notes = adminNotes || null;

    const updated = await this.hubTransferRecordRepository.save(record);

    console.log(
      `[TRANSFER APPROVED] Record ${recordId} approved by admin ${adminUserId}`,
    );

    return updated;
  }

  /**
   * Reject transfer record
   */
  async rejectTransferRecord(
    recordId: string,
    adminUserId: string,
    rejectionReason: string,
    adminNotes?: string,
  ): Promise<HubTransferRecord> {
    const record = await this.hubTransferRecordRepository.findOne({
      where: { id: recordId },
      relations: ['hubManager', 'hubManager.user', 'hub'],
    });

    if (!record) {
      throw new NotFoundException('Transfer record not found');
    }

    if (record.status !== TransferRecordStatus.PENDING) {
      throw new BadRequestException('Only pending records can be rejected');
    }

    record.status = TransferRecordStatus.REJECTED;
    record.reviewed_by = adminUserId;
    record.reviewed_at = new Date();
    record.rejection_reason = rejectionReason;
    record.admin_notes = adminNotes || null;

    const updated = await this.hubTransferRecordRepository.save(record);

    console.log(
      `[TRANSFER REJECTED] Record ${recordId} rejected by admin ${adminUserId}`,
    );

    return updated;
  }

  // ===== MERCHANT CLEARANCE =====

  /**
   * Get merchant clearance list
   * Shows merchants with unpaid parcels (paid_to_merchant = false)
   * All unpaid parcels are treated as "delivered" for clearance purposes
   */
  async getMerchantClearanceList(query: {
    page?: number;
    limit?: number;
    merchantId?: string;
    search?: string;
  }): Promise<{
    merchants: any[];
    total: number;
    summary: any;
  }> {
    const { page = 1, limit = 10, merchantId, search } = query;

    // Build where clause
    const whereClause: any = { paid_to_merchant: false };
    if (merchantId) {
      whereClause.merchant_id = merchantId;
    }

    // Get ALL unpaid parcels
    const unpaidParcels = await this.parcelRepository.find({
      where: whereClause,
    });

    // Group parcels by merchant_id (which is actually Merchant.id, not User.id)
    const parcelsByMerchant = new Map<string, typeof unpaidParcels>();
    for (const parcel of unpaidParcels) {
      const mid = parcel.merchant_id;
      if (!parcelsByMerchant.has(mid)) {
        parcelsByMerchant.set(mid, []);
      }
      parcelsByMerchant.get(mid)!.push(parcel);
    }

    // Get all unique merchant IDs
    const merchantIds = Array.from(parcelsByMerchant.keys());

    // Fetch Merchant entities with User relation to get name and phone
    const merchants = await this.merchantRepository.find({
      where: merchantIds.map((id) => ({ id })),
      relations: ['user'], // Load the User relation from Merchant
    });

    // Create a map of merchant_id -> Merchant (with User)
    const merchantInfoMap = new Map<string, Merchant>();
    for (const merchant of merchants) {
      merchantInfoMap.set(merchant.id, merchant);
    }

    // Build the clearance list with proper merchant info
    let merchantMap = new Map<
      string,
      {
        merchant_name: string;
        phone_number: string;
        parcels: typeof unpaidParcels;
      }
    >();

    for (const [mid, parcels] of parcelsByMerchant.entries()) {
      const merchant = merchantInfoMap.get(mid);
      merchantMap.set(mid, {
        merchant_name: merchant?.user?.full_name || 'N/A',
        phone_number: merchant?.user?.phone || 'N/A',
        parcels,
      });
    }

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      const filteredMap = new Map<
        string,
        typeof merchantMap extends Map<string, infer V> ? V : never
      >();
      for (const [mid, data] of merchantMap.entries()) {
        if (
          data.merchant_name.toLowerCase().includes(searchLower) ||
          data.phone_number.toLowerCase().includes(searchLower)
        ) {
          filteredMap.set(mid, data);
        }
      }
      merchantMap = filteredMap;
    }

    // Calculate stats for each merchant
    const merchantClearanceList = Array.from(merchantMap.entries()).map(
      ([mid, data]) => {
        const parcels = data.parcels;

        // Calculate totals
        const totalCollectedAmount = parcels.reduce(
          (sum, p) => sum + Number(p.cod_collected_amount || p.cod_amount || 0),
          0,
        );

        const totalDeliveryCharge = parcels.reduce(
          (sum, p) => sum + Number(p.delivery_charge || 0),
          0,
        );

        const totalReturnCharge = parcels.reduce(
          (sum, p) => sum + Number(p.return_charge || 0),
          0,
        );

        const dueAmount =
          totalCollectedAmount - totalDeliveryCharge - totalReturnCharge;

        const totalReturned = parcels.filter(
          (p) =>
            p.status === ParcelStatus.RETURNED ||
            p.status === ParcelStatus.RETURNED_TO_HUB ||
            p.status === ParcelStatus.RETURN_TO_MERCHANT ||
            p.status === ParcelStatus.PAID_RETURN ||
            p.return_charge_applicable === true ||
            String(p.return_charge_applicable) === 'true',
        ).length;

        return {
          merchant_id: mid,
          merchant_name: data.merchant_name,
          phone_number: data.phone_number,
          total_parcels: parcels.length,
          total_delivered: parcels.length - totalReturned, // Adjusted delivered to not include returned
          total_returned: totalReturned,
          total_collected_amount: totalCollectedAmount,
          total_delivery_charge: totalDeliveryCharge,
          total_return_charge: totalReturnCharge,
          total_due_amount: dueAmount,
        };
      },
    );

    // Apply pagination
    const total = merchantClearanceList.length;
    const paginatedList = merchantClearanceList.slice(
      (page - 1) * limit,
      page * limit,
    );

    // Calculate grand totals for summary
    const grandTotals = merchantClearanceList.reduce(
      (acc, m) => ({
        total_parcels: acc.total_parcels + m.total_parcels,
        total_delivered: acc.total_delivered + m.total_delivered,
        total_returned: acc.total_returned + m.total_returned,
        total_collected_amount:
          acc.total_collected_amount + m.total_collected_amount,
        total_delivery_charge:
          acc.total_delivery_charge + m.total_delivery_charge,
        total_return_charge: acc.total_return_charge + m.total_return_charge,
        total_due_amount: acc.total_due_amount + m.total_due_amount,
      }),
      {
        total_parcels: 0,
        total_delivered: 0,
        total_returned: 0,
        total_collected_amount: 0,
        total_delivery_charge: 0,
        total_return_charge: 0,
        total_due_amount: 0,
      },
    );

    return {
      merchants: paginatedList,
      total,
      summary: grandTotals,
    };
  }

  // ===== ADMIN PARCEL LISTING =====

  /**
   * Get all parcels in the system with rich data (Admin)
   * Supports search, filtering, and pagination
   */
  async getAllParcels(query: AdminParcelQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'created_at',
      order = 'DESC',
      status,
      hubId,
      merchantId,
      storeId,
      customerName,
      customerPhone,
      merchantName,
      minAmount,
      maxAmount,
      deliveryType,
    } = query;

    const skip = (page - 1) * limit;

    // Active parcel statuses for the "ACTIVE" filter
    const activeParcelStatuses = [
      ParcelStatus.PENDING,
      ParcelStatus.PICKED_UP,
      ParcelStatus.IN_TRANSIT,
      ParcelStatus.IN_HUB,
      ParcelStatus.ASSIGNED_TO_RIDER,
      ParcelStatus.OUT_FOR_DELIVERY,
      ParcelStatus.DELIVERY_RESCHEDULED,
    ];

    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.merchant', 'merchant')
      .leftJoinAndSelect('merchant.user', 'merchantUser')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('store.hub', 'storeHub')
      .leftJoinAndSelect('store.merchant', 'storeMerchant')
      .leftJoinAndSelect('storeMerchant.user', 'storeMerchantUser')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .leftJoinAndSelect('parcel.delivery_coverage_area', 'coverageArea')
      .leftJoinAndSelect('parcel.assignedRider', 'assignedRider')
      .leftJoinAndSelect('assignedRider.user', 'assignedRiderUser')
      .leftJoinAndSelect('assignedRider.hub', 'assignedRiderHub')
      .leftJoinAndSelect('parcel.currentHub', 'currentHub')
      .leftJoinAndSelect('parcel.originHub', 'originHub')
      .leftJoinAndSelect('parcel.destinationHub', 'destinationHub')
      .leftJoinAndSelect('parcel.thirdPartyProvider', 'thirdPartyProvider');

    // Status filter
    if (status === 'ACTIVE') {
      queryBuilder.where('parcel.status IN (:...activeStatuses)', {
        activeStatuses: activeParcelStatuses,
      });
    } else if (status) {
      queryBuilder.where('parcel.status = :status', { status });
    } else {
      queryBuilder.where('1=1');
    }

    // Hub filter
    if (hubId) {
      queryBuilder.andWhere('parcel.current_hub_id = :hubId', { hubId });
    }

    // Merchant filter
    if (merchantId) {
      queryBuilder.andWhere('parcel.merchant_id = :merchantId', { merchantId });
    }

    // Store filter
    if (storeId) {
      queryBuilder.andWhere('parcel.store_id = :storeId', { storeId });
    }

    // Customer name filter
    if (customerName?.trim()) {
      queryBuilder.andWhere('parcel.customer_name ILIKE :customerName', {
        customerName: `%${customerName.trim()}%`,
      });
    }

    // Customer phone filter
    if (customerPhone?.trim()) {
      queryBuilder.andWhere('parcel.customer_phone ILIKE :customerPhone', {
        customerPhone: `%${customerPhone.trim()}%`,
      });
    }

    // Merchant name filter
    if (merchantName?.trim()) {
      queryBuilder.andWhere('merchantUser.full_name ILIKE :merchantName', {
        merchantName: `%${merchantName.trim()}%`,
      });
    }

    // Amount range filters
    if (minAmount !== undefined) {
      queryBuilder.andWhere(
        'COALESCE(parcel.cod_amount, parcel.product_price, parcel.total_charge, 0) >= :minAmount',
        { minAmount },
      );
    }

    if (maxAmount !== undefined) {
      queryBuilder.andWhere(
        'COALESCE(parcel.cod_amount, parcel.product_price, parcel.total_charge, 0) <= :maxAmount',
        { maxAmount },
      );
    }

    // Delivery type filter
    if (deliveryType !== undefined) {
      queryBuilder.andWhere('parcel.delivery_type = :deliveryType', {
        deliveryType,
      });
    }

    // Search filter
    if (search?.trim()) {
      const keyword = `%${search.trim()}%`;
      queryBuilder.andWhere(
        `(
          CAST(parcel.id AS TEXT) ILIKE :keyword OR
          parcel.tracking_number ILIKE :keyword OR
          parcel.parcel_tx_id ILIKE :keyword OR
          parcel.merchant_order_id ILIKE :keyword OR
          parcel.customer_name ILIKE :keyword OR
          parcel.customer_phone ILIKE :keyword OR
          merchantUser.full_name ILIKE :keyword OR
          store.business_name ILIKE :keyword OR
          coverageArea.area ILIKE :keyword OR
          coverageArea.zone ILIKE :keyword OR
          coverageArea.city ILIKE :keyword OR
          parcel.delivery_area ILIKE :keyword
        )`,
        { keyword },
      );
    }

    // Sorting
    const sortFieldMap: Record<string, string> = {
      created_at: 'parcel.created_at',
      updated_at: 'parcel.updated_at',
      tracking_number: 'parcel.tracking_number',
      parcel_tx_id: 'parcel.parcel_tx_id',
      customer_name: 'parcel.customer_name',
      merchant_name: 'merchantUser.full_name',
      status: 'parcel.status',
      cod_amount: 'parcel.cod_amount',
      total_charge: 'parcel.total_charge',
    };

    const normalizedSortBy = (sortBy || '').trim().toLowerCase();
    const safeSortBy = sortFieldMap[normalizedSortBy] || 'parcel.created_at';

    queryBuilder.orderBy(safeSortBy, order || 'DESC');

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    const parcels = await queryBuilder.getMany();

    // Transform to response format
    const items = parcels.map((parcel) => {
      const item = toParcelListItem(parcel);

      // Calculate age in days
      const now = new Date();
      const created = parcel.created_at ? new Date(parcel.created_at) : null;
      const ageDays = created
        ? Math.floor(
            (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
          )
        : null;

      return {
        ...item,
        age_days: ageDays,
      };
    });

    return {
      parcels: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }
}
