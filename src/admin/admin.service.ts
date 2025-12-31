import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Parcel } from '../parcels/entities/parcel.entity';
import { HubTransferRecord } from '../hubs/entities/hub-transfer-record.entity';
import { UsersService } from '../users/users.service';
import { UserRole } from '../common/enums/user-role.enum';
import { TransferRecordStatus } from '../common/enums/transfer-record-status.enum';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { TransferRecordQueryDto } from '../hubs/dto/transfer-record-query.dto';

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
    private usersService: UsersService,
  ) {}

  async create(dto: CreateAdminDto): Promise<User> {
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

    // Create admin user
    const admin = await this.usersService.create({
      full_name: dto.fullName,
      phone: dto.phone,
      email: dto.email || undefined,
      password_hash: passwordHash,
      role: UserRole.ADMIN,
      is_active: true,
    });

    console.log(`[ADMIN CREATED] New admin user: ${admin.full_name} (${admin.phone})`);

    return admin;
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      where: { role: UserRole.ADMIN },
      select: ['id', 'full_name', 'phone', 'email', 'role', 'is_active', 'created_at', 'updated_at'],
    });
  }

  async findOne(id: string): Promise<User> {
    const admin = await this.userRepository.findOne({
      where: { id, role: UserRole.ADMIN },
      select: ['id', 'full_name', 'phone', 'email', 'role', 'is_active', 'created_at', 'updated_at'],
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

    console.log(`[ADMIN UPDATED] Admin user updated: ${admin.full_name} (${admin.id})`);

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

    console.log(`[ADMIN DELETED] Admin user deleted: ${admin.full_name} (${admin.id})`);
  }

  async deactivate(id: string): Promise<User> {
    const admin = await this.findOne(id);

    admin.is_active = false;
    await this.userRepository.save(admin);

    console.log(`[ADMIN DEACTIVATED] Admin user deactivated: ${admin.full_name} (${admin.id})`);

    return admin;
  }

  async activate(id: string): Promise<User> {
    const admin = await this.findOne(id);

    admin.is_active = true;
    await this.userRepository.save(admin);

    console.log(`[ADMIN ACTIVATED] Admin user activated: ${admin.full_name} (${admin.id})`);

    return admin;
  }

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
      where: merchantIds.map(id => ({ id })),
      relations: ['user'],  // Load the User relation from Merchant
    });

    // Create a map of merchant_id -> Merchant (with User)
    const merchantInfoMap = new Map<string, Merchant>();
    for (const merchant of merchants) {
      merchantInfoMap.set(merchant.id, merchant);
    }

    // Build the clearance list with proper merchant info
    let merchantMap = new Map<string, {
      merchant_name: string;
      phone_number: string;
      parcels: typeof unpaidParcels;
    }>();

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
      const filteredMap = new Map<string, typeof merchantMap extends Map<string, infer V> ? V : never>();
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
    const merchantClearanceList = Array.from(merchantMap.entries()).map(([, data]) => {
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

      const dueAmount = totalCollectedAmount - totalDeliveryCharge - totalReturnCharge;

      return {
        merchant_name: data.merchant_name,
        phone_number: data.phone_number,
        total_parcels: parcels.length,
        total_delivered: parcels.length,
        total_collected_amount: totalCollectedAmount,
        total_delivery_charge: totalDeliveryCharge,
        total_return_charge: totalReturnCharge,
        total_due_amount: dueAmount,
      };
    });

    // Apply pagination
    const total = merchantClearanceList.length;
    const paginatedList = merchantClearanceList.slice((page - 1) * limit, page * limit);

    // Calculate grand totals for summary
    const grandTotals = merchantClearanceList.reduce(
      (acc, m) => ({
        total_parcels: acc.total_parcels + m.total_parcels,
        total_delivered: acc.total_delivered + m.total_delivered,
        total_collected_amount: acc.total_collected_amount + m.total_collected_amount,
        total_delivery_charge: acc.total_delivery_charge + m.total_delivery_charge,
        total_return_charge: acc.total_return_charge + m.total_return_charge,
        total_due_amount: acc.total_due_amount + m.total_due_amount,
      }),
      {
        total_parcels: 0,
        total_delivered: 0,
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
}
