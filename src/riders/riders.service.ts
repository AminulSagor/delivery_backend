import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Rider } from './entities/rider.entity';
import { User } from '../users/entities/user.entity';
import { Parcel } from '../parcels/entities/parcel.entity';
import { PickupRequest } from '../pickup-requests/entities/pickup-request.entity';
import { Hub } from '../hubs/entities/hub.entity';
import { CreateRiderDto } from './dto/create-rider.dto';
import { UpdateRiderDto } from './dto/update-rider.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { ParcelStatus } from '../parcels/entities/parcel.entity';
import { PickupRequestStatus } from '../common/enums/pickup-request-status.enum';
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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Parcel)
    private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(PickupRequest)
    private readonly pickupRequestRepository: Repository<PickupRequest>,
    @InjectRepository(Hub)
    private readonly hubRepository: Repository<Hub>,
    @InjectRepository(EmergencyAlert)
    private readonly alertRepository: Repository<EmergencyAlert>,
    private readonly dataSource: DataSource,
  ) {}

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

      // Create rider with hub auto-assigned
      const rider = queryRunner.manager.create(Rider, {
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
        is_active: true,
      });

      const savedRider = await queryRunner.manager.save(Rider, rider);

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

      // Create rider with specified hub
      const rider = queryRunner.manager.create(Rider, {
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
        is_active: true,
      });

      const savedRider = await queryRunner.manager.save(Rider, rider);

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
   * Get all riders (with optional filters)
   */
  async findAll(
    hubId?: string,
    isActive?: boolean,
    page: number = 1,
    limit: number = 20,
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
   * Get rider dashboard statistics
   *
   * Rider Workflow:
   * 1. PICKUPS: Parcels assigned to rider, waiting to be picked from hub
   *    - Status: ASSIGNED_TO_RIDER
   * 2. DELIVERIES: Parcels rider has picked up and is delivering to customer
   *    - Pending: OUT_FOR_DELIVERY
   *    - Completed: DELIVERED, PARTIAL_DELIVERY, EXCHANGE, DELIVERY_RESCHEDULED
   * 3. RETURNS: Parcels that failed delivery and need to be returned to hub
   *    - Pending: RETURNED, PAID_RETURN
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

    // ===== PICKUPS: Parcels assigned to rider, need to pick from hub =====
    const pickupsFromHub = await this.parcelRepository.count({
      where: {
        assigned_rider_id: riderId,
        status: ParcelStatus.ASSIGNED_TO_RIDER,
      },
    });

    // ===== DELIVERIES: Pending (OUT_FOR_DELIVERY) + Completed (DELIVERED, PARTIAL_DELIVERY, EXCHANGE, RESCHEDULED) =====
    const pendingDeliveries = await this.parcelRepository.count({
      where: {
        assigned_rider_id: riderId,
        status: ParcelStatus.OUT_FOR_DELIVERY,
      },
    });

    const completedDeliveries = await this.parcelRepository.count({
      where: [
        { assigned_rider_id: riderId, status: ParcelStatus.DELIVERED },
        { assigned_rider_id: riderId, status: ParcelStatus.PARTIAL_DELIVERY },
        { assigned_rider_id: riderId, status: ParcelStatus.EXCHANGE },
        {
          assigned_rider_id: riderId,
          status: ParcelStatus.DELIVERY_RESCHEDULED,
        },
      ],
    });

    // ===== RETURNS: Pending (RETURNED, PAID_RETURN) + Completed (RETURNED_TO_HUB, RETURN_TO_MERCHANT) =====
    const pendingReturns = await this.parcelRepository.count({
      where: [
        { assigned_rider_id: riderId, status: ParcelStatus.RETURNED },
        { assigned_rider_id: riderId, status: ParcelStatus.PAID_RETURN },
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
      total_pickups: pickupsFromHub,
      // Deliveries section
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
