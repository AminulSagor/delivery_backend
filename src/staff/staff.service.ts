import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Staff } from './entities/staff.entity';
import { User } from '../users/entities/user.entity';
import { Hub } from '../hubs/entities/hub.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UserRole } from '../common/enums/user-role.enum';
import * as bcrypt from 'bcrypt';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Hub)
    private readonly hubRepository: Repository<Hub>,
    private readonly dataSource: DataSource,
  ) {}

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
      // Hash password
      const hashedPassword = await bcrypt.hash(createStaffDto.password, 10);

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

      // Generate staff code
      const staffCount = await queryRunner.manager.count(Staff);
      const staffCode = `STF${String(staffCount + 1).padStart(4, '0')}`;

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
  async findAll(hubId?: string, isActive?: boolean): Promise<Staff[]> {
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

    return await query.getMany();
  }

  /**
   * Get single staff by ID
   */
  async findOne(id: string): Promise<Staff> {
    const staff = await this.staffRepository.findOne({
      where: { id },
      relations: ['user', 'hub'],
    });

    if (!staff) {
      throw new NotFoundException(`Staff with ID "${id}" not found`);
    }

    return staff;
  }

  /**
   * Update staff
   */
  async update(id: string, updateStaffDto: UpdateStaffDto): Promise<Staff> {
    const staff = await this.findOne(id);

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
      return await this.findOne(id);
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
  async remove(id: string): Promise<void> {
    const staff = await this.findOne(id);

    await this.staffRepository.update(id, { is_active: false });
    await this.userRepository.update(staff.user_id, { is_active: false });
  }

  /**
   * Deactivate staff
   */
  async deactivate(id: string): Promise<Staff> {
    const staff = await this.findOne(id);
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
    return await this.findOne(id);
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

    return staff.map((s) => ({
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
      last_paid: null, // TODO: Implement staff payment tracking
    }));
  }
}
