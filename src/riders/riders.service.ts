import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, Not } from 'typeorm';
import { Rider } from './entities/rider.entity';
import { RiderPayoutMethod } from './entities/rider-payout-method.entity';
import { User } from '../users/entities/user.entity';
import { Parcel } from '../parcels/entities/parcel.entity';
import { PickupRequest } from '../pickup-requests/entities/pickup-request.entity';
import { Hub } from '../hubs/entities/hub.entity';
import { Staff } from '../staff/entities/staff.entity';
import { CreateRiderDto } from './dto/create-rider.dto';
import { UpdateRiderDto } from './dto/update-rider.dto';
import { UpdateRiderProfileDto } from './dto/update-rider-profile.dto';
import { UpdateRiderDocumentsDto } from './dto/update-rider-documents.dto';
import { UpdateRiderPasswordDto } from './dto/update-rider-password.dto';
import { AddRiderPayoutMethodDto } from './dto/add-rider-payout-method.dto';
import { UpdateRiderPayoutMethodDto } from './dto/update-rider-payout-method.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { StaffPosition } from '../common/enums/staff-position.enum';
import { ParcelStatus } from '../parcels/entities/parcel.entity';
import { PickupRequestStatus } from '../common/enums/pickup-request-status.enum';
import { RiderApprovalStatus } from '../common/enums/rider-approval-status.enum';
import { PayoutMethodType } from '../common/enums/payout-method-type.enum';
import * as bcrypt from 'bcrypt';
import { CreateEmergencyDto } from './dto/create-emergency.dto';
import { EmergencyAlert } from './entities/emergency-alert.entity';
import { EmergencyStatus } from 'src/common/enums/emergency-type.enum';
// import { ResolveEmergencyDto } from './dto/resolve-emergency.dto';

@Injectable()
export class RidersService {
  constructor(
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(RiderPayoutMethod)
    private readonly riderPayoutMethodRepository: Repository<RiderPayoutMethod>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Parcel)
    private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(PickupRequest)
    private readonly pickupRequestRepository: Repository<PickupRequest>,
    @InjectRepository(Hub)
    private readonly hubRepository: Repository<Hub>,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(EmergencyAlert)
    private readonly alertRepository: Repository<EmergencyAlert>,
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

    private async generateUniqueRiderCode(manager: EntityManager): Promise<string> {
      const maxAttempts = 50;

      for (let i = 0; i < maxAttempts; i++) {
        const riderCode = `RDR${this.generateRandomDigits(5)}`;
        const existing = await manager.findOne(Rider, {
          where: { rider_code: riderCode },
          select: ['id'],
        });

        if (!existing) return riderCode;
      }

      throw new ConflictException('Unable to generate unique rider code');
    }

    private async generateUniqueStaffCode(manager: EntityManager): Promise<string> {
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
   * Create rider by Hub Manager (auto-assigns current hub)
   */
  async createByHubManager(
    createRiderDto: CreateRiderDto,
    hubManagerHubId: string,
  ): Promise<Rider> {
    // Validate hub_id is provided
    if (!hubManagerHubId) {
      throw new BadRequestException(
        'Hub Manager is not assigned to any hub. Please contact admin to link your account to a hub.',
      );
    }

    // Validate hub exists in database
    const hub = await this.hubRepository.findOne({
      where: { id: hubManagerHubId },
    });

    if (!hub) {
      throw new BadRequestException(
        `Hub with ID "${hubManagerHubId}" does not exist. Please contact admin to fix your hub assignment.`,
      );
    }

    // Check if phone already exists
    const existingUser = await this.userRepository.findOne({
      where: { phone: createRiderDto.phone },
    });

    if (existingUser) {
      throw new ConflictException('Phone number already registered');
    }

    // Check if email exists (if provided)
    if (createRiderDto.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: createRiderDto.email },
      });

      if (existingEmail) {
        throw new ConflictException('Email already registered');
      }
    }

    // Check if NID already exists
    const existingNID = await this.riderRepository.findOne({
      where: { nid_number: createRiderDto.nid_number },
    });

    if (existingNID) {
      throw new ConflictException('NID number already registered');
    }

    // Use transaction to ensure atomicity - rollback user if rider creation fails
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(createRiderDto.password, 10);

      // Create user (inactive until admin approves rider)
      const user = queryRunner.manager.create(User, {
        full_name: createRiderDto.full_name,
        phone: createRiderDto.phone,
        email: createRiderDto.email,
        password_hash: hashedPassword,
        role: UserRole.RIDER,
        is_active: false,
      });

      const savedUser = await queryRunner.manager.save(User, user);

      const riderCode = await this.generateUniqueRiderCode(queryRunner.manager);
      const staffCode = await this.generateUniqueStaffCode(queryRunner.manager);

      // Create rider with hub auto-assigned (pending admin approval)
      const rider = queryRunner.manager.create(Rider, {
        rider_code: riderCode,
        user_id: savedUser.id,
        hub_id: hubManagerHubId,
        photo: createRiderDto.photo,
        guardian_mobile_no: createRiderDto.guardian_mobile_no,
        bike_type: createRiderDto.bike_type,
        nid_number: createRiderDto.nid_number,
        license_no: createRiderDto.license_no,
        present_address: createRiderDto.present_address,
        permanent_address: createRiderDto.permanent_address,
        fixed_salary: createRiderDto.fixed_salary,
        commission_per_delivery: createRiderDto.commission_per_delivery,
        bank_name: createRiderDto.bank_name,
        bank_account_number: createRiderDto.bank_account_number,
        bank_branch: createRiderDto.bank_branch,
        nid_front_photo: createRiderDto.nid_front_photo,
        nid_back_photo: createRiderDto.nid_back_photo,
        license_front_photo: createRiderDto.license_front_photo,
        license_back_photo: createRiderDto.license_back_photo,
        parent_nid_front_photo: createRiderDto.parent_nid_front_photo,
        parent_nid_back_photo: createRiderDto.parent_nid_back_photo,
        approval_status: RiderApprovalStatus.PENDING,
        is_active: false,
      });

      const savedRider = await queryRunner.manager.save(Rider, rider);

      // Create corresponding staff record with RIDER position (inactive until approved)
      const staff = queryRunner.manager.create(Staff, {
        user_id: savedUser.id,
        hub_id: hubManagerHubId,
        staff_code: staffCode,
        position: StaffPosition.RIDER,
        photo: createRiderDto.photo,
        guardian_mobile_no: createRiderDto.guardian_mobile_no,
        bike_type: createRiderDto.bike_type,
        nid_number: createRiderDto.nid_number,
        license_no: createRiderDto.license_no,
        present_address: createRiderDto.present_address,
        permanent_address: createRiderDto.permanent_address,
        fixed_salary: createRiderDto.fixed_salary,
        bank_name: createRiderDto.bank_name,
        bank_account_number: createRiderDto.bank_account_number,
        bank_branch: createRiderDto.bank_branch,
        nid_front_photo: createRiderDto.nid_front_photo,
        nid_back_photo: createRiderDto.nid_back_photo,
        license_front_photo: createRiderDto.license_front_photo,
        license_back_photo: createRiderDto.license_back_photo,
        parent_nid_front_photo: createRiderDto.parent_nid_front_photo,
        parent_nid_back_photo: createRiderDto.parent_nid_back_photo,
        is_active: false,
      });

      await queryRunner.manager.save(Staff, staff);

      // Commit transaction
      await queryRunner.commitTransaction();

      // Load rider with user relation for response
      const riderWithRelations = await this.riderRepository.findOne({
        where: { id: savedRider.id },
        relations: ['user', 'hub'],
      });

      return riderWithRelations!;
    } catch (error) {
      // Rollback transaction on any error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  /**
   * Create rider by Admin (manual hub assignment required)
   */
  async createByAdmin(createRiderDto: CreateRiderDto): Promise<Rider> {
    if (!createRiderDto.hub_id) {
      throw new BadRequestException(
        'hub_id is required when creating rider as admin',
      );
    }

    // Validate hub exists in database
    const hub = await this.hubRepository.findOne({
      where: { id: createRiderDto.hub_id },
    });

    if (!hub) {
      throw new BadRequestException(
        `Hub with ID "${createRiderDto.hub_id}" does not exist. Please provide a valid hub_id.`,
      );
    }

    // Check if phone already exists
    const existingUser = await this.userRepository.findOne({
      where: { phone: createRiderDto.phone },
    });

    if (existingUser) {
      throw new ConflictException('Phone number already registered');
    }

    // Check if email exists (if provided)
    if (createRiderDto.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: createRiderDto.email },
      });

      if (existingEmail) {
        throw new ConflictException('Email already registered');
      }
    }

    // Check if NID already exists
    const existingNID = await this.riderRepository.findOne({
      where: { nid_number: createRiderDto.nid_number },
    });

    if (existingNID) {
      throw new ConflictException('NID number already registered');
    }

    // Use transaction to ensure atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(createRiderDto.password, 10);

      // Create user
      const user = queryRunner.manager.create(User, {
        full_name: createRiderDto.full_name,
        phone: createRiderDto.phone,
        email: createRiderDto.email,
        password_hash: hashedPassword,
        role: UserRole.RIDER,
        is_active: true,
      });

      const savedUser = await queryRunner.manager.save(User, user);

      const riderCode = await this.generateUniqueRiderCode(queryRunner.manager);
      const staffCode = await this.generateUniqueStaffCode(queryRunner.manager);

      // Create rider with specified hub (auto-approved by admin)
      const rider = queryRunner.manager.create(Rider, {
        rider_code: riderCode,
        user_id: savedUser.id,
        hub_id: createRiderDto.hub_id,
        photo: createRiderDto.photo,
        guardian_mobile_no: createRiderDto.guardian_mobile_no,
        bike_type: createRiderDto.bike_type,
        nid_number: createRiderDto.nid_number,
        license_no: createRiderDto.license_no,
        present_address: createRiderDto.present_address,
        permanent_address: createRiderDto.permanent_address,
        fixed_salary: createRiderDto.fixed_salary,
        commission_per_delivery: createRiderDto.commission_per_delivery,
        bank_name: createRiderDto.bank_name,
        bank_account_number: createRiderDto.bank_account_number,
        bank_branch: createRiderDto.bank_branch,
        nid_front_photo: createRiderDto.nid_front_photo,
        nid_back_photo: createRiderDto.nid_back_photo,
        license_front_photo: createRiderDto.license_front_photo,
        license_back_photo: createRiderDto.license_back_photo,
        parent_nid_front_photo: createRiderDto.parent_nid_front_photo,
        parent_nid_back_photo: createRiderDto.parent_nid_back_photo,
        approval_status: RiderApprovalStatus.APPROVED,
        is_active: true,
      });

      const savedRider = await queryRunner.manager.save(Rider, rider);

      // Create corresponding staff record with RIDER position
      const staff = queryRunner.manager.create(Staff, {
        user_id: savedUser.id,
        hub_id: createRiderDto.hub_id,
        staff_code: staffCode,
        position: StaffPosition.RIDER,
        photo: createRiderDto.photo,
        guardian_mobile_no: createRiderDto.guardian_mobile_no,
        bike_type: createRiderDto.bike_type,
        nid_number: createRiderDto.nid_number,
        license_no: createRiderDto.license_no,
        present_address: createRiderDto.present_address,
        permanent_address: createRiderDto.permanent_address,
        fixed_salary: createRiderDto.fixed_salary,
        bank_name: createRiderDto.bank_name,
        bank_account_number: createRiderDto.bank_account_number,
        bank_branch: createRiderDto.bank_branch,
        nid_front_photo: createRiderDto.nid_front_photo,
        nid_back_photo: createRiderDto.nid_back_photo,
        license_front_photo: createRiderDto.license_front_photo,
        license_back_photo: createRiderDto.license_back_photo,
        parent_nid_front_photo: createRiderDto.parent_nid_front_photo,
        parent_nid_back_photo: createRiderDto.parent_nid_back_photo,
        is_active: true,
      });

      await queryRunner.manager.save(Staff, staff);

      // Commit transaction
      await queryRunner.commitTransaction();

      // Load rider with relations for response
      const riderWithRelations = await this.riderRepository.findOne({
        where: { id: savedRider.id },
        relations: ['user', 'hub'],
      });

      return riderWithRelations!;
    } catch (error) {
      // Rollback transaction on any error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  /**
   * Approve rider (Admin only)
   */
  async approveRider(riderId: string, adminId: string): Promise<Rider> {
    const rider = await this.riderRepository.findOne({
      where: { id: riderId },
      relations: ['user'],
    });

    if (!rider) {
      throw new NotFoundException(`Rider with ID ${riderId} not found`);
    }

    if (rider.approval_status === RiderApprovalStatus.APPROVED) {
      throw new ConflictException('Rider is already approved');
    }

    rider.approval_status = RiderApprovalStatus.APPROVED;
    rider.approved_at = new Date();
    rider.approved_by = adminId;
    rider.is_active = true;

    // Activate the user account
    const user = await this.userRepository.findOne({
      where: { id: rider.user_id },
    });
    if (user) {
      user.is_active = true;
      await this.userRepository.save(user);
    }

    // Activate the staff record
    const staff = await this.staffRepository.findOne({
      where: { user_id: rider.user_id },
    });
    if (staff) {
      staff.is_active = true;
      await this.staffRepository.save(staff);
    }

    await this.riderRepository.save(rider);

    return (await this.riderRepository.findOne({
      where: { id: riderId },
      relations: ['user', 'hub'],
    }))!;
  }

  /**
   * Reject rider (Admin only)
   */
  async rejectRider(riderId: string, adminId: string): Promise<Rider> {
    const rider = await this.riderRepository.findOne({
      where: { id: riderId },
      relations: ['user'],
    });

    if (!rider) {
      throw new NotFoundException(`Rider with ID ${riderId} not found`);
    }

    if (rider.approval_status === RiderApprovalStatus.REJECTED) {
      throw new ConflictException('Rider is already rejected');
    }

    if (rider.approval_status === RiderApprovalStatus.APPROVED) {
      throw new ConflictException('Cannot reject an already approved rider');
    }

    rider.approval_status = RiderApprovalStatus.REJECTED;
    rider.approved_by = adminId;
    rider.is_active = false;

    await this.riderRepository.save(rider);

    return (await this.riderRepository.findOne({
      where: { id: riderId },
      relations: ['user', 'hub'],
    }))!;
  }

  /**
   * Get all riders (with optional filters)
   */
  async findAll(
    hubId?: string,
    isActive?: boolean,
    page: number = 1,
    limit: number = 20,
    approvalStatus?: RiderApprovalStatus,
  ): Promise<{ riders: Rider[]; total: number }> {
    const query = this.riderRepository
      .createQueryBuilder('rider')
      .leftJoinAndSelect('rider.user', 'user')
      .leftJoinAndSelect('rider.hub', 'hub');

    if (hubId) {
      query.andWhere('rider.hub_id = :hubId', { hubId });
    }

    if (isActive !== undefined) {
      query.andWhere('rider.is_active = :isActive', { isActive });
    }

    if (approvalStatus) {
      query.andWhere('rider.approval_status = :approvalStatus', {
        approvalStatus,
      });
    }

    query
      .orderBy('rider.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [riders, total] = await query.getManyAndCount();

    return { riders, total };
  }

  /**
   * Get rider by ID
   */
  async findOne(id: string): Promise<Rider> {
    const rider = await this.riderRepository.findOne({
      where: { id },
      relations: ['user', 'hub'],
    });

    if (!rider) {
      throw new NotFoundException(`Rider with ID ${id} not found`);
    }

    return rider;
  }

  /**
   * Get rider by user ID
   */
  async findByUserId(userId: string): Promise<Rider> {
    const rider = await this.riderRepository.findOne({
      where: { user_id: userId },
      relations: ['user', 'hub'],
    });

    if (!rider) {
      throw new NotFoundException(`Rider not found for user ID ${userId}`);
    }

    return rider;
  }

  /**
   * Rider self profile update
   */
  async updateMyProfile(
    userId: string,
    riderId: string,
    dto: UpdateRiderProfileDto,
  ): Promise<Rider> {
    const rider = await this.riderRepository.findOne({
      where: { id: riderId },
      relations: ['user', 'hub'],
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    if (rider.user_id !== userId) {
      throw new BadRequestException('You can only update your own profile');
    }

    if (
      dto.optional_phone_number &&
      dto.guardian_mobile_no &&
      dto.optional_phone_number !== dto.guardian_mobile_no
    ) {
      throw new BadRequestException(
        'Use either optional_phone_number or guardian_mobile_no with the same value',
      );
    }

    const user = rider.user;

    if (dto.full_name) {
      user.full_name = dto.full_name;
    }

    if (dto.phone && dto.phone !== user.phone) {
      const existingPhone = await this.userRepository.findOne({
        where: { phone: dto.phone },
      });

      if (existingPhone && existingPhone.id !== user.id) {
        throw new ConflictException('Phone number already registered');
      }

      user.phone = dto.phone;
    }

    if (dto.email && dto.email !== user.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: dto.email },
      });

      if (existingEmail && existingEmail.id !== user.id) {
        throw new ConflictException('Email already registered');
      }

      user.email = dto.email;
    }

    const optionalPhone = dto.optional_phone_number ?? dto.guardian_mobile_no;
    if (optionalPhone) {
      rider.guardian_mobile_no = optionalPhone;
    }

    await this.userRepository.save(user);
    await this.riderRepository.save(rider);

    return (await this.riderRepository.findOne({
      where: { id: riderId },
      relations: ['user', 'hub'],
    }))!;
  }

  /**
   * Rider self documents update
   */
  async updateMyDocuments(
    userId: string,
    riderId: string,
    dto: UpdateRiderDocumentsDto,
  ): Promise<Rider> {
    const rider = await this.riderRepository.findOne({
      where: { id: riderId },
      relations: ['user', 'hub'],
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    if (rider.user_id !== userId) {
      throw new BadRequestException('You can only update your own documents');
    }

    if (dto.nid_number && dto.nid_number !== rider.nid_number) {
      const existingNID = await this.riderRepository.findOne({
        where: {
          nid_number: dto.nid_number,
          id: Not(riderId),
        },
      });

      if (existingNID) {
        throw new ConflictException('NID number already registered');
      }

      rider.nid_number = dto.nid_number;
    }

    if (dto.nid_front_photo !== undefined) {
      rider.nid_front_photo = dto.nid_front_photo;
    }

    if (dto.nid_back_photo !== undefined) {
      rider.nid_back_photo = dto.nid_back_photo;
    }

    if (dto.license_no !== undefined) {
      rider.license_no = dto.license_no;
    }

    if (dto.license_front_photo !== undefined) {
      rider.license_front_photo = dto.license_front_photo;
    }

    if (dto.license_back_photo !== undefined) {
      rider.license_back_photo = dto.license_back_photo;
    }

    await this.riderRepository.save(rider);

    return (await this.riderRepository.findOne({
      where: { id: riderId },
      relations: ['user', 'hub'],
    }))!;
  }

  /**
   * Rider self password update
   */
  async updateMyPassword(
    userId: string,
    riderId: string,
    dto: UpdateRiderPasswordDto,
  ): Promise<void> {
    const rider = await this.riderRepository.findOne({
      where: { id: riderId },
      relations: ['user'],
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    if (rider.user_id !== userId) {
      throw new BadRequestException('You can only update your own password');
    }

    if (dto.new_password !== dto.confirm_new_password) {
      throw new BadRequestException('New password and confirm password do not match');
    }

    if (dto.current_password === dto.new_password) {
      throw new BadRequestException('New password must be different from current password');
    }

    const user = rider.user;

    const isCurrentPasswordValid = await bcrypt.compare(
      dto.current_password,
      user.password_hash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.password_hash = await bcrypt.hash(dto.new_password, 10);
    await this.userRepository.save(user);
  }

  /**
   * Get available payout methods for rider
   */
  async getAvailablePayoutMethods(
    userId: string,
    riderId: string,
  ): Promise<PayoutMethodType[]> {
    await this.ensureRiderOwnership(userId, riderId);

    return Object.values(PayoutMethodType);
  }

  /**
   * Get rider payout methods (masked account details)
   */
  async getMyPayoutMethods(userId: string, riderId: string) {
    await this.ensureRiderOwnership(userId, riderId);

    const methods = await this.riderPayoutMethodRepository.find({
      where: { rider_id: riderId },
      order: { is_default: 'DESC', created_at: 'ASC' },
    });

    return methods.map((method) => this.toRiderPayoutMethodResponse(method));
  }

  /**
   * Add rider payout method
   */
  async addMyPayoutMethod(
    userId: string,
    riderId: string,
    dto: AddRiderPayoutMethodDto,
  ) {
    await this.ensureRiderOwnership(userId, riderId);

    if (dto.is_active !== undefined) {
      throw new BadRequestException(
        'Only admin can update payout method status',
      );
    }

    const bankAccountNumber = dto.account_number ?? dto.account_no;
    if (
      dto.method_type === PayoutMethodType.BANK_ACCOUNT &&
      bankAccountNumber
    ) {
      await this.ensureUniqueBankAccountNumber(riderId, bankAccountNumber);
    }

    if (dto.method_type === PayoutMethodType.BKASH && dto.bkash_number) {
      await this.ensureUniqueBkashNumber(riderId, dto.bkash_number);
    }

    if (dto.method_type === PayoutMethodType.NAGAD && dto.nagad_number) {
      await this.ensureUniqueNagadNumber(riderId, dto.nagad_number);
    }

    const payoutMethod = this.riderPayoutMethodRepository.create({
      rider_id: riderId,
      method_type: dto.method_type,
      is_default: false,
      is_active: true,
      bank_name: dto.bank_name || null,
      branch_name: dto.branch_name || null,
      account_holder_name:
        dto.account_holder_name || dto.account_name || null,
      account_number: dto.account_number || dto.account_no || null,
      routing_number: dto.routing_number || null,
      bkash_number: dto.bkash_number || null,
      bkash_account_holder_name: dto.bkash_account_holder_name || null,
      bkash_account_type: dto.bkash_account_type || null,
      nagad_number: dto.nagad_number || null,
      nagad_account_holder_name: dto.nagad_account_holder_name || null,
      nagad_account_type: dto.nagad_account_type || null,
    });

    let saved = await this.riderPayoutMethodRepository.save(payoutMethod);

    if (dto.is_default === true) {
      await this.riderPayoutMethodRepository.update(
        { rider_id: riderId, is_default: true },
        { is_default: false },
      );

      saved.is_default = true;
      saved = await this.riderPayoutMethodRepository.save(saved);
    }

    await this.ensureDefaultActivePayoutMethod(riderId);

    const latest = await this.riderPayoutMethodRepository.findOne({
      where: { id: saved.id, rider_id: riderId },
    });

    return this.toRiderPayoutMethodResponse(latest || saved);
  }

  /**
   * Update rider payout method details
   */
  async updateMyPayoutMethod(
    userId: string,
    riderId: string,
    methodId: string,
    dto: UpdateRiderPayoutMethodDto,
  ) {
    const method = await this.findOwnedRiderPayoutMethod(
      userId,
      riderId,
      methodId,
    );

    if (dto.method_type && dto.method_type !== method.method_type) {
      throw new BadRequestException(
        'Method type cannot be changed. Create a new payout method instead.',
      );
    }

    if (dto.is_default !== undefined) {
      throw new BadRequestException(
        'Use set-default endpoint to update default method',
      );
    }

    if (dto.is_active !== undefined) {
      throw new BadRequestException(
        'Only admin can update payout method status',
      );
    }

    if (method.method_type === PayoutMethodType.BANK_ACCOUNT) {
      const accountNumber = dto.account_number ?? dto.account_no;
      if (
        accountNumber !== undefined &&
        accountNumber !== method.account_number
      ) {
        await this.ensureUniqueBankAccountNumber(
          riderId,
          accountNumber,
          method.id,
        );
      }

      if (dto.bank_name !== undefined) {
        method.bank_name = dto.bank_name;
      }

      if (dto.branch_name !== undefined) {
        method.branch_name = dto.branch_name;
      }

      const accountHolderName = dto.account_holder_name ?? dto.account_name;
      if (accountHolderName !== undefined) {
        method.account_holder_name = accountHolderName;
      }

      if (accountNumber !== undefined) {
        method.account_number = accountNumber;
      }

      if (dto.routing_number !== undefined) {
        method.routing_number = dto.routing_number;
      }
    }

    if (method.method_type === PayoutMethodType.BKASH) {
      if (
        dto.bkash_number !== undefined &&
        dto.bkash_number !== method.bkash_number
      ) {
        await this.ensureUniqueBkashNumber(riderId, dto.bkash_number, method.id);
      }

      if (dto.bkash_number !== undefined) {
        method.bkash_number = dto.bkash_number;
      }

      if (dto.bkash_account_holder_name !== undefined) {
        method.bkash_account_holder_name = dto.bkash_account_holder_name;
      }

      if (dto.bkash_account_type !== undefined) {
        method.bkash_account_type = dto.bkash_account_type;
      }
    }

    if (method.method_type === PayoutMethodType.NAGAD) {
      if (
        dto.nagad_number !== undefined &&
        dto.nagad_number !== method.nagad_number
      ) {
        await this.ensureUniqueNagadNumber(riderId, dto.nagad_number, method.id);
      }

      if (dto.nagad_number !== undefined) {
        method.nagad_number = dto.nagad_number;
      }

      if (dto.nagad_account_holder_name !== undefined) {
        method.nagad_account_holder_name = dto.nagad_account_holder_name;
      }

      if (dto.nagad_account_type !== undefined) {
        method.nagad_account_type = dto.nagad_account_type;
      }
    }

    const saved = await this.riderPayoutMethodRepository.save(method);
    return this.toRiderPayoutMethodResponse(saved);
  }

  /**
   * Set default rider payout method
   */
  async setMyPayoutMethodDefault(
    userId: string,
    riderId: string,
    methodId: string,
  ) {
    const method = await this.findOwnedRiderPayoutMethod(
      userId,
      riderId,
      methodId,
    );

    if (!method.is_active) {
      throw new BadRequestException(
        'Inactive payout method cannot be set as default',
      );
    }

    await this.riderPayoutMethodRepository.update(
      { rider_id: riderId, is_default: true },
      { is_default: false },
    );

    method.is_default = true;
    const saved = await this.riderPayoutMethodRepository.save(method);

    return this.toRiderPayoutMethodResponse(saved);
  }

  private async ensureRiderOwnership(
    userId: string,
    riderId: string,
  ): Promise<void> {
    const rider = await this.riderRepository.findOne({
      where: { id: riderId },
      select: ['id', 'user_id'],
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    if (rider.user_id !== userId) {
      throw new BadRequestException(
        'You can only manage your own payout methods',
      );
    }
  }

  private async findOwnedRiderPayoutMethod(
    userId: string,
    riderId: string,
    methodId: string,
  ): Promise<RiderPayoutMethod> {
    await this.ensureRiderOwnership(userId, riderId);

    const method = await this.riderPayoutMethodRepository.findOne({
      where: { id: methodId, rider_id: riderId },
    });

    if (!method) {
      throw new NotFoundException('Payout method not found');
    }

    return method;
  }

  private async ensureDefaultActivePayoutMethod(riderId: string): Promise<void> {
    const activeDefault = await this.riderPayoutMethodRepository.findOne({
      where: { rider_id: riderId, is_default: true, is_active: true },
    });

    if (activeDefault) {
      return;
    }

    await this.riderPayoutMethodRepository.update(
      { rider_id: riderId, is_default: true },
      { is_default: false },
    );

    const firstActiveMethod = await this.riderPayoutMethodRepository.findOne({
      where: { rider_id: riderId, is_active: true },
      order: { created_at: 'ASC' },
    });

    if (!firstActiveMethod) {
      return;
    }

    firstActiveMethod.is_default = true;
    await this.riderPayoutMethodRepository.save(firstActiveMethod);
  }

  private async ensureUniqueBankAccountNumber(
    riderId: string,
    accountNumber: string,
    excludeMethodId?: string,
  ): Promise<void> {
    const where: Record<string, any> = {
      rider_id: riderId,
      method_type: PayoutMethodType.BANK_ACCOUNT,
      account_number: accountNumber,
    };

    if (excludeMethodId) {
      where.id = Not(excludeMethodId);
    }

    const existing = await this.riderPayoutMethodRepository.findOne({ where });
    if (existing) {
      throw new ConflictException('Bank account number already exists');
    }
  }

  private async ensureUniqueBkashNumber(
    riderId: string,
    bkashNumber: string,
    excludeMethodId?: string,
  ): Promise<void> {
    const where: Record<string, any> = {
      rider_id: riderId,
      method_type: PayoutMethodType.BKASH,
      bkash_number: bkashNumber,
    };

    if (excludeMethodId) {
      where.id = Not(excludeMethodId);
    }

    const existing = await this.riderPayoutMethodRepository.findOne({ where });
    if (existing) {
      throw new ConflictException('bKash number already exists');
    }
  }

  private async ensureUniqueNagadNumber(
    riderId: string,
    nagadNumber: string,
    excludeMethodId?: string,
  ): Promise<void> {
    const where: Record<string, any> = {
      rider_id: riderId,
      method_type: PayoutMethodType.NAGAD,
      nagad_number: nagadNumber,
    };

    if (excludeMethodId) {
      where.id = Not(excludeMethodId);
    }

    const existing = await this.riderPayoutMethodRepository.findOne({ where });
    if (existing) {
      throw new ConflictException('Nagad number already exists');
    }
  }

  private toRiderPayoutMethodResponse(method: RiderPayoutMethod) {
    return {
      id: method.id,
      method_type: method.method_type,
      status: method.is_active ? 'ACTIVE' : 'INACTIVE',
      is_active: method.is_active,
      is_default: method.is_default,
      bank: method.method_type === PayoutMethodType.BANK_ACCOUNT
        ? {
            bank_name: method.bank_name,
            branch_name: method.branch_name,
            account_name: method.account_holder_name,
            account_number: this.maskSensitiveNumber(method.account_number),
            routing_number: method.routing_number,
          }
        : null,
      bkash: method.method_type === PayoutMethodType.BKASH
        ? {
            number: this.maskSensitiveNumber(method.bkash_number),
            account_holder_name: method.bkash_account_holder_name,
            account_type: method.bkash_account_type,
          }
        : null,
      nagad: method.method_type === PayoutMethodType.NAGAD
        ? {
            number: this.maskSensitiveNumber(method.nagad_number),
            account_holder_name: method.nagad_account_holder_name,
            account_type: method.nagad_account_type,
          }
        : null,
      created_at: method.created_at,
      updated_at: method.updated_at,
    };
  }

  private maskSensitiveNumber(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const digits = value.replace(/\D/g, '');
    if (!digits) {
      return null;
    }

    if (digits.length <= 3) {
      return digits;
    }

    return `${'*'.repeat(digits.length - 3)}${digits.slice(-3)}`;
  }

  /**
   * Update rider
   */
  async update(id: string, updateRiderDto: UpdateRiderDto): Promise<Rider> {
    const rider = await this.findOne(id);

    // Check NID uniqueness if being updated
    if (
      updateRiderDto.nid_number &&
      updateRiderDto.nid_number !== rider.nid_number
    ) {
      const existingNID = await this.riderRepository.findOne({
        where: { nid_number: updateRiderDto.nid_number },
      });

      if (existingNID) {
        throw new ConflictException('NID number already registered');
      }
    }

    // Update user fields if provided
    if (
      updateRiderDto.full_name ||
      updateRiderDto.phone ||
      updateRiderDto.email
    ) {
      const user = await this.userRepository.findOne({
        where: { id: rider.user_id },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (updateRiderDto.full_name) {
        user.full_name = updateRiderDto.full_name;
      }

      if (updateRiderDto.phone && updateRiderDto.phone !== user.phone) {
        const existingPhone = await this.userRepository.findOne({
          where: { phone: updateRiderDto.phone },
        });

        if (existingPhone) {
          throw new ConflictException('Phone number already registered');
        }

        user.phone = updateRiderDto.phone;
      }

      if (updateRiderDto.email && updateRiderDto.email !== user.email) {
        const existingEmail = await this.userRepository.findOne({
          where: { email: updateRiderDto.email },
        });

        if (existingEmail) {
          throw new ConflictException('Email already registered');
        }

        user.email = updateRiderDto.email;
      }

      await this.userRepository.save(user);
    }

    // Update rider fields
    Object.assign(rider, updateRiderDto);

    return await this.riderRepository.save(rider);
  }

  /**
   * Deactivate rider
   */
  async deactivate(id: string): Promise<Rider> {
    const rider = await this.findOne(id);
    rider.is_active = false;

    // Also deactivate user
    const user = await this.userRepository.findOne({
      where: { id: rider.user_id },
    });

    if (user) {
      user.is_active = false;
      await this.userRepository.save(user);
    }

    return await this.riderRepository.save(rider);
  }

  /**
   * Activate rider
   */
  async activate(id: string): Promise<Rider> {
    const rider = await this.findOne(id);
    rider.is_active = true;

    // Also activate user
    const user = await this.userRepository.findOne({
      where: { id: rider.user_id },
    });

    if (user) {
      user.is_active = true;
      await this.userRepository.save(user);
    }

    return await this.riderRepository.save(rider);
  }

  /**
   * Decline rider - Permanent deactivation (sets status to REJECTED)
   */
  async decline(id: string): Promise<Rider> {
    const rider = await this.findOne(id);

    // Set rider status to REJECTED (permanent)
    rider.approval_status = RiderApprovalStatus.REJECTED;
    rider.is_active = false;

    // Also deactivate user permanently
    const user = await this.userRepository.findOne({
      where: { id: rider.user_id },
    });

    if (user) {
      user.is_active = false;
      await this.userRepository.save(user);
    }

    console.log(
      `[RIDER DECLINED] Rider permanently declined: ${rider.user?.full_name} (${rider.id})`,
    );

    return await this.riderRepository.save(rider);
  }

  /**
   * Get rider dashboard statistics
   *
   * Rider Workflow:
   * 1. PICKUPS: Pickup requests assigned to rider (from merchants)
   *    - Status: CONFIRMED pickup requests
   * 2. DELIVERIES: Parcels assigned to rider for delivery to customer
   *    - Pending: ASSIGNED_TO_RIDER (assigned by hub, ready to deliver)
   *    - Completed: DELIVERED, PARTIAL_DELIVERY, EXCHANGE, PAID_RETURN
   * 3. RETURNS: Parcels that failed delivery and need to be returned to hub
   *    - Pending: RETURNED, DELIVERY_RESCHEDULED
   *    - Completed: RETURNED_TO_HUB, RETURN_TO_MERCHANT
   */
  async getRiderDashboard(riderId: string) {
    // Verify rider exists
    const rider = await this.riderRepository.findOne({
      where: { id: riderId },
      relations: ['user'],
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    // ===== PICKUPS: Pickup requests assigned to this rider (CONFIRMED status) =====
    const pendingPickups = await this.pickupRequestRepository.count({
      where: {
        assigned_rider_id: riderId,
        status: PickupRequestStatus.CONFIRMED,
      },
    });

    // ===== DELIVERIES: Pending (ASSIGNED_TO_RIDER) =====
    // ASSIGNED_TO_RIDER = parcel assigned by hub, ready for rider to deliver
    const pendingDeliveries = await this.parcelRepository.count({
      where: {
        assigned_rider_id: riderId,
        status: ParcelStatus.ASSIGNED_TO_RIDER,
      },
    });

    const completedDeliveries = await this.parcelRepository.count({
      where: [
        { assigned_rider_id: riderId, status: ParcelStatus.DELIVERED },
        { assigned_rider_id: riderId, status: ParcelStatus.PARTIAL_DELIVERY },
        { assigned_rider_id: riderId, status: ParcelStatus.EXCHANGE },
        { assigned_rider_id: riderId, status: ParcelStatus.PAID_RETURN },
      ],
    });

    // ===== RETURNS: Pending (RETURNED, DELIVERY_RESCHEDULED) + Completed (RETURNED_TO_HUB, RETURN_TO_MERCHANT) =====
    const pendingReturns = await this.parcelRepository.count({
      where: [
        { assigned_rider_id: riderId, status: ParcelStatus.RETURNED },
        {
          assigned_rider_id: riderId,
          status: ParcelStatus.DELIVERY_RESCHEDULED,
        },
      ],
    });

    const completedReturns = await this.parcelRepository.count({
      where: [
        { assigned_rider_id: riderId, status: ParcelStatus.RETURNED_TO_HUB },
        { assigned_rider_id: riderId, status: ParcelStatus.RETURN_TO_MERCHANT },
      ],
    });

    return {
      rider: {
        id: rider.id,
      },
      // Pickups section (pickup requests from merchants)
      pending_pickups: pendingPickups,
      // Deliveries section (parcels assigned for delivery)
      pending_deliveries: pendingDeliveries,
      completed_deliveries: completedDeliveries,
      total_deliveries: pendingDeliveries + completedDeliveries,
      // Returns section
      pending_returns: pendingReturns,
      completed_returns: completedReturns,
      total_returns: pendingReturns + completedReturns,
    };
  }

  /**
   * Rider triggers an emergency alert
   */

  async createAlert(
    riderId: string,
    dto: CreateEmergencyDto,
  ): Promise<EmergencyAlert> {
    const rider = await this.riderRepository.findOne({
      where: { id: riderId },
    });
    if (!rider) throw new NotFoundException('Rider not found');

    const alert = this.alertRepository.create({
      rider_id: riderId,
      hub_id: rider.hub_id, // Auto-route to rider's current hub
      type: dto.type,
      latitude: dto.latitude,
      longitude: dto.longitude,
      location_address: dto.location_address,
      description: dto.description,
      status: EmergencyStatus.PENDING,
    });

    return await this.alertRepository.save(alert);
  }
}
