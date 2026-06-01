import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Staff } from './entities/staff.entity';
import { StaffFinance } from './entities/staff-finance.entity';
import { User } from '../users/entities/user.entity';
import { Hub } from '../hubs/entities/hub.entity';
import { Rider } from '../riders/entities/rider.entity';
import { HubManager } from '../hubs/entities/hub-manager.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { StaffPosition } from '../common/enums/staff-position.enum';
import * as bcrypt from 'bcrypt';
import { PayoutTransactionStatus } from '../common/enums/payout-transaction-status.enum';
import { PayoutTransaction } from '../merchant/entities/payout-transaction.entity';
import { PayoutMethodType } from '../common/enums/payout-method-type.enum';
import { PayoutMethodStatus } from '../common/enums/payout-method-status.enum';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(StaffFinance)
    private readonly staffFinanceRepository: Repository<StaffFinance>,
    @InjectRepository(PayoutTransaction)
    private readonly payoutRepository: Repository<PayoutTransaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Hub)
    private readonly hubRepository: Repository<Hub>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(HubManager)
    private readonly hubManagerRepository: Repository<HubManager>,
    private readonly dataSource: DataSource,
  ) {}

  private generateRandomDigits(length: number): string {
    const chars = '0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateRandomPassword(length = 12): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async generateUniqueStaffCode(
    manager: EntityManager,
  ): Promise<string> {
    const maxAttempts = 50;

    for (let i = 0; i < maxAttempts; i++) {
      const staffCode = `EMP${this.generateRandomDigits(5)}`;
      const existing = await manager.findOne(Staff, {
        where: { staff_code: staffCode },
        select: ['id'],
      });

      if (!existing) return staffCode;
    }

    throw new ConflictException('Unable to generate unique staff code');
  }

  /**
   * Create staff by Admin
   */
  async createByAdmin(createStaffDto: CreateStaffDto): Promise<Staff> {
    // Validate hub exists
    const hub = await this.hubRepository.findOne({
      where: { id: createStaffDto.hub_id },
    });

    if (!hub) {
      throw new BadRequestException(
        `Hub with ID "${createStaffDto.hub_id}" does not exist`,
      );
    }

    // Check if phone already exists
    const existingUser = await this.userRepository.findOne({
      where: { phone: createStaffDto.phone },
    });

    if (existingUser) {
      throw new ConflictException('Phone number already registered');
    }

    // Check if email exists (if provided)
    if (createStaffDto.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: createStaffDto.email },
      });

      if (existingEmail) {
        throw new ConflictException('Email already registered');
      }
    }

    // Check if NID already exists
    const existingNID = await this.staffRepository.findOne({
      where: { nid_number: createStaffDto.nid_number },
    });

    if (existingNID) {
      throw new ConflictException('NID number already registered');
    }

    // Use transaction to ensure atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Hash password (generate a secure random one when admin doesn't provide)
      const rawPassword = createStaffDto.password ?? this.generateRandomPassword(12);
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      // Create user
      const user = queryRunner.manager.create(User, {
        full_name: createStaffDto.full_name,
        phone: createStaffDto.phone,
        email: createStaffDto.email,
        password_hash: hashedPassword,
        role: UserRole.STAFF,
        is_active: true,
      });

      const savedUser = await queryRunner.manager.save(User, user);

      const staffCode = await this.generateUniqueStaffCode(queryRunner.manager);

      // Create staff
      const staff = queryRunner.manager.create(Staff, {
        user_id: savedUser.id,
        hub_id: createStaffDto.hub_id,
        staff_code: staffCode,
        position: createStaffDto.position,
        photo: createStaffDto.photo,
        secondary_phone: createStaffDto.secondary_phone,
        guardian_mobile_no: createStaffDto.guardian_mobile_no,
        bike_type: createStaffDto.bike_type,
        nid_number: createStaffDto.nid_number,
        license_no: createStaffDto.license_no,
        present_address: createStaffDto.present_address,
        permanent_address: createStaffDto.permanent_address,
        fixed_salary: createStaffDto.fixed_salary,
        bank_name: createStaffDto.bank_name,
        bank_account_number: createStaffDto.bank_account_number,
        bank_branch: createStaffDto.bank_branch,
        nid_front_photo: createStaffDto.nid_front_photo,
        nid_back_photo: createStaffDto.nid_back_photo,
        license_front_photo: createStaffDto.license_front_photo,
        license_back_photo: createStaffDto.license_back_photo,
        parent_nid_front_photo: createStaffDto.parent_nid_front_photo,
        parent_nid_back_photo: createStaffDto.parent_nid_back_photo,
        is_active: true,
      });

      const savedStaff = await queryRunner.manager.save(Staff, staff);

      // ALWAYS create a staff payout method record with bank account
      const StaffPayoutMethod = (await import('./entities/staff-payout-method.entity')).StaffPayoutMethod;
      const payoutRepo = queryRunner.manager.getRepository(StaffPayoutMethod);

      const payoutMethod = payoutRepo.create({
        staff_id: savedStaff.id,
        method_type: PayoutMethodType.BANK_ACCOUNT,
        status: PayoutMethodStatus.VERIFIED,
        is_default: true,
        is_active: true,
        bank_name: createStaffDto.bank_name,
        district: createStaffDto.district,
        branch_name: createStaffDto.bank_branch,
        account_holder_name: createStaffDto.account_holder_name,
        account_number: createStaffDto.bank_account_number,
        routing_number: createStaffDto.routing_number,
      });

      await payoutRepo.save(payoutMethod);

      // Create staff finance record for balance tracking
      const staffFinance = this.staffFinanceRepository.create({
        staff_id: savedStaff.id,
        total_paid_amount: 0,
        remaining_balance: createStaffDto.fixed_salary || 0,
        last_payout_at: null,
        last_payout_amount: null,
      });

      await queryRunner.manager.save(StaffFinance, staffFinance);

      // Commit transaction
      await queryRunner.commitTransaction();

      // Load staff with user relation for response
      const staffWithRelations = await this.staffRepository.findOne({
        where: { id: savedStaff.id },
        relations: ['user', 'hub'],
      });

      if (!staffWithRelations) {
        throw new Error('Failed to retrieve created staff');
      }

      return staffWithRelations;
    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  /**
   * Get all staff with filters
   */
  async findAll(
    hubId?: string,
    isActive?: boolean,
    search?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Staff[]; total: number }> {
    const skip = (page - 1) * limit;

    const query = this.staffRepository
      .createQueryBuilder('staff')
      .leftJoinAndSelect('staff.user', 'user')
      .leftJoinAndSelect('staff.hub', 'hub')
      .orderBy('staff.created_at', 'DESC');

    if (hubId) {
      query.andWhere('staff.hub_id = :hubId', { hubId });
    }

    if (isActive !== undefined) {
      query.andWhere('staff.is_active = :isActive', { isActive });
    }

    if (search) {
      query.andWhere(
        '(user.full_name ILIKE :search OR user.phone ILIKE :search OR staff.staff_code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await query.skip(skip).take(limit).getManyAndCount();
    return { data, total };
  }

  /**
   * Get staff summary metrics for list endpoint
   */
  async getSummary(
    hubId?: string,
    search?: string,
  ): Promise<{
    totalStaff: number;
    active: number;
    inactive: number;
    riders: number;
    couriers: number;
    totalSalary: number;
  }> {
    const query = this.staffRepository
      .createQueryBuilder('staff')
      .leftJoin('staff.user', 'user')
      .select('COUNT(staff.id)', 'totalStaff')
      .addSelect(
        'SUM(CASE WHEN staff.is_active = true THEN 1 ELSE 0 END)',
        'active',
      )
      .addSelect(
        'SUM(CASE WHEN staff.is_active = false THEN 1 ELSE 0 END)',
        'inactive',
      )
      .addSelect(
        'SUM(CASE WHEN staff.position = :riderPosition THEN 1 ELSE 0 END)',
        'riders',
      )
      .addSelect(
        'SUM(CASE WHEN staff.position = :courierPosition THEN 1 ELSE 0 END)',
        'couriers',
      )
      .addSelect('COALESCE(SUM(staff.fixed_salary), 0)', 'totalSalary')
      .setParameters({
        riderPosition: StaffPosition.RIDER,
        courierPosition: StaffPosition.COURIER,
      });

    if (hubId) {
      query.andWhere('staff.hub_id = :hubId', { hubId });
    }

    if (search) {
      query.andWhere(
        '(user.full_name ILIKE :search OR user.phone ILIKE :search OR staff.staff_code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const summary = await query.getRawOne<{
      totalStaff: string;
      active: string;
      inactive: string;
      riders: string;
      couriers: string;
      totalSalary: string;
    }>();

    // Also include riders and hub managers in total salary calculation
    const riderQuery = this.riderRepository
      .createQueryBuilder('rider')
      .select('COALESCE(SUM(rider.fixed_salary), 0)', 'sum');

    const hubManagerQuery = this.hubManagerRepository
      .createQueryBuilder('hubManager')
      .select('COALESCE(SUM(hubManager.fixed_salary), 0)', 'sum');

    if (hubId) {
      riderQuery.where('rider.hub_id = :hubId', { hubId });
      hubManagerQuery.where('hubManager.hub_id = :hubId', { hubId });
    }

    const riderSumRes = await riderQuery.getRawOne<{ sum: string }>();
    const hubManagerSumRes = await hubManagerQuery.getRawOne<{ sum: string }>();

    const staffSum = Number(summary?.totalSalary || 0);
    const riderSum = Number(riderSumRes?.sum || 0);
    const hubManagerSum = Number(hubManagerSumRes?.sum || 0);

    return {
      totalStaff: parseInt(summary?.totalStaff || '0', 10),
      active: parseInt(summary?.active || '0', 10),
      inactive: parseInt(summary?.inactive || '0', 10),
      riders: parseInt(summary?.riders || '0', 10),
      couriers: parseInt(summary?.couriers || '0', 10),
      totalSalary: staffSum + riderSum + hubManagerSum,
    };
  }

  /**
   * Get single staff by ID
   */
  async findOne(id: string, scopeHubId?: string): Promise<Staff> {
    const whereClause: any = { id };
    if (scopeHubId) {
      whereClause.hub_id = scopeHubId;
    }

    const staff = await this.staffRepository.findOne({
      where: whereClause,
      relations: ['user', 'hub'],
    });

    if (!staff) {
      if (scopeHubId) {
        throw new NotFoundException('Staff not found in your hub');
      }

      throw new NotFoundException(`Staff with ID "${id}" not found`);
    }

    return staff;
  }

  /**
   * Update staff
   */
  async update(
    id: string,
    updateStaffDto: UpdateStaffDto,
    scopeHubId?: string,
  ): Promise<Staff> {
    const staff = await this.findOne(id, scopeHubId);

    if (
      scopeHubId &&
      updateStaffDto.hub_id &&
      updateStaffDto.hub_id !== scopeHubId
    ) {
      throw new BadRequestException(
        'Hub manager can only assign staff within your hub',
      );
    }

    // If updating hub, verify it exists
    if (updateStaffDto.hub_id) {
      const hub = await this.hubRepository.findOne({
        where: { id: updateStaffDto.hub_id },
      });

      if (!hub) {
        throw new BadRequestException(
          `Hub with ID "${updateStaffDto.hub_id}" does not exist`,
        );
      }
    }

    // If updating phone, check uniqueness
    if (updateStaffDto.phone && updateStaffDto.phone !== staff.user.phone) {
      const existingUser = await this.userRepository.findOne({
        where: { phone: updateStaffDto.phone },
      });

      if (existingUser) {
        throw new ConflictException('Phone number already registered');
      }
    }

    // If updating email, check uniqueness
    if (updateStaffDto.email && updateStaffDto.email !== staff.user.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: updateStaffDto.email },
      });

      if (existingEmail) {
        throw new ConflictException('Email already registered');
      }
    }

    // If updating NID, check uniqueness
    if (
      updateStaffDto.nid_number &&
      updateStaffDto.nid_number !== staff.nid_number
    ) {
      const existingNID = await this.staffRepository.findOne({
        where: { nid_number: updateStaffDto.nid_number },
      });

      if (existingNID) {
        throw new ConflictException('NID number already registered');
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update user fields if provided
      if (
        updateStaffDto.full_name ||
        updateStaffDto.phone ||
        updateStaffDto.email ||
        updateStaffDto.password
      ) {
        const userUpdate: any = {};

        if (updateStaffDto.full_name)
          userUpdate.full_name = updateStaffDto.full_name;
        if (updateStaffDto.phone) userUpdate.phone = updateStaffDto.phone;
        if (updateStaffDto.email) userUpdate.email = updateStaffDto.email;
        if (updateStaffDto.password) {
          userUpdate.password_hash = await bcrypt.hash(
            updateStaffDto.password,
            10,
          );
        }

        await queryRunner.manager.update(User, staff.user_id, userUpdate);
      }

      // Update staff fields
      const staffUpdate: any = {};

      if (updateStaffDto.hub_id) staffUpdate.hub_id = updateStaffDto.hub_id;
      if (updateStaffDto.position)
        staffUpdate.position = updateStaffDto.position;
      if (updateStaffDto.photo !== undefined)
        staffUpdate.photo = updateStaffDto.photo;
      if (updateStaffDto.secondary_phone !== undefined)
        staffUpdate.secondary_phone = updateStaffDto.secondary_phone;
      if (updateStaffDto.guardian_mobile_no)
        staffUpdate.guardian_mobile_no = updateStaffDto.guardian_mobile_no;
      if (updateStaffDto.bike_type)
        staffUpdate.bike_type = updateStaffDto.bike_type;
      if (updateStaffDto.nid_number)
        staffUpdate.nid_number = updateStaffDto.nid_number;
      if (updateStaffDto.license_no !== undefined)
        staffUpdate.license_no = updateStaffDto.license_no;
      if (updateStaffDto.present_address)
        staffUpdate.present_address = updateStaffDto.present_address;
      if (updateStaffDto.permanent_address)
        staffUpdate.permanent_address = updateStaffDto.permanent_address;
      if (updateStaffDto.position !== undefined)
        staffUpdate.position = updateStaffDto.position;
      if (updateStaffDto.fixed_salary !== undefined)
        staffUpdate.fixed_salary = updateStaffDto.fixed_salary;
      if (updateStaffDto.bank_name !== undefined)
        staffUpdate.bank_name = updateStaffDto.bank_name;
      if (updateStaffDto.bank_account_number !== undefined)
        staffUpdate.bank_account_number = updateStaffDto.bank_account_number;
      if (updateStaffDto.bank_branch !== undefined)
        staffUpdate.bank_branch = updateStaffDto.bank_branch;
      if (updateStaffDto.nid_front_photo)
        staffUpdate.nid_front_photo = updateStaffDto.nid_front_photo;
      if (updateStaffDto.nid_back_photo)
        staffUpdate.nid_back_photo = updateStaffDto.nid_back_photo;
      if (updateStaffDto.license_front_photo !== undefined)
        staffUpdate.license_front_photo = updateStaffDto.license_front_photo;
      if (updateStaffDto.license_back_photo !== undefined)
        staffUpdate.license_back_photo = updateStaffDto.license_back_photo;
      if (updateStaffDto.parent_nid_front_photo)
        staffUpdate.parent_nid_front_photo =
          updateStaffDto.parent_nid_front_photo;
      if (updateStaffDto.parent_nid_back_photo)
        staffUpdate.parent_nid_back_photo =
          updateStaffDto.parent_nid_back_photo;
      if (updateStaffDto.is_active !== undefined)
        staffUpdate.is_active = updateStaffDto.is_active;

      await queryRunner.manager.update(Staff, id, staffUpdate);

      await queryRunner.commitTransaction();

      // Return updated staff
      return await this.findOne(id, scopeHubId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Delete staff (soft delete by setting is_active to false)
   */
  async remove(id: string, scopeHubId?: string): Promise<void> {
    const staff = await this.findOne(id, scopeHubId);

    await this.staffRepository.update(id, { is_active: false });
    await this.userRepository.update(staff.user_id, { is_active: false });
  }

  /**
   * Deactivate staff
   */
  async deactivate(id: string, scopeHubId?: string): Promise<Staff> {
    const staff = await this.findOne(id, scopeHubId);
    staff.is_active = false;

    // Also deactivate user
    const user = await this.userRepository.findOne({
      where: { id: staff.user_id },
    });

    if (user) {
      user.is_active = false;
      await this.userRepository.save(user);
    }

    await this.staffRepository.save(staff);

    // Return with relations
    return await this.findOne(id, scopeHubId);
  }

  /**
   * Activate staff
   */
  async activate(id: string): Promise<Staff> {
    const staff = await this.findOne(id);
    staff.is_active = true;

    // Also activate user
    const user = await this.userRepository.findOne({
      where: { id: staff.user_id },
    });

    if (user) {
      user.is_active = true;
      await this.userRepository.save(user);
    }

    await this.staffRepository.save(staff);

    // Return with relations
    return await this.findOne(id);
  }

  /**
   * Get staff count by hub
   */
  async getStaffCountByHub(hubId: string): Promise<number> {
    return await this.staffRepository.count({
      where: { hub_id: hubId, is_active: true },
    });
  }

  /**
   * Get formatted staff list for admin
   */
  async getFormattedStaffList() {
    const staff = await this.staffRepository
      .createQueryBuilder('staff')
      .leftJoinAndSelect('staff.user', 'user')
      .leftJoinAndSelect('staff.hub', 'hub')
      .where('staff.is_active = :isActive', { isActive: true })
      .orderBy('staff.created_at', 'ASC')
      .getMany();
    // Include last paid date by checking staff payout transactions
    const results = await Promise.all(
      staff.map(async (s) => {
        const last = await this.payoutRepository.findOne({
          where: {
            staff_id: s.id,
            status: PayoutTransactionStatus.COMPLETED,
          },
          order: { completed_at: 'DESC' },
        });

        return {
          id: s.staff_code || 'N/A',
          profile: {
            name: s.user?.full_name || 'N/A',
            phone: s.user?.phone || 'N/A',
            photo: s.photo || null,
          },
          position: s.position,
          assigned_hub: {
            id: s.hub_id,
            name: s.hub?.branch_name || 'N/A',
            code: s.hub?.hub_code || 'N/A',
          },
          secondary_phone: s.secondary_phone || null,
          salary: parseFloat(s.fixed_salary.toString()),
          last_paid: last?.completed_at || null,
        };
      }),
    );

    return results;
  }

  /**
   * Initiate a payout for a single staff member. Creates a payout transaction record
   * with status PENDING. Actual processing/integration with payment provider
   * should be handled by background worker or admin processing flow.
   */
  async payStaff(
    staffId: string,
    amount: number,
    initiatedBy?: string | null,
  ): Promise<any> {
    const staff = await this.staffRepository.findOne({ where: { id: staffId } });
    if (!staff) throw new NotFoundException(`Staff with ID "${staffId}" not found`);

    const tx = this.payoutRepository.create({
      staff_id: staffId,
      merchant_id: null,
      payout_method_id: null,
      amount,
      status: PayoutTransactionStatus.PENDING,
      initiated_by: initiatedBy || null,
      reference_number: null,
      admin_notes: null,
      failure_reason: null,
    });

    return await this.payoutRepository.save(tx);
  }
}
