import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
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
}
