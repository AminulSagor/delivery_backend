import { 
  Injectable, 
  NotFoundException, 
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Logger
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hub } from './entities/hub.entity';
import { HubManager } from './entities/hub-manager.entity';
import { CreateHubDto } from './dto/create-hub.dto';
import { UpdateHubDto } from './dto/update-hub.dto';
import { UsersService } from '../users/users.service';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class HubsService {
  private readonly logger = new Logger(HubsService.name);

  constructor(
    @InjectRepository(Hub)
    private readonly hubRepository: Repository<Hub>,
    @InjectRepository(HubManager)
    private readonly hubManagerRepository: Repository<HubManager>,
    private readonly usersService: UsersService,
  ) {}

  async create(createHubDto: CreateHubDto): Promise<Hub> {
    try {
      // Validate hub_code format
      if (!createHubDto.hub_code || createHubDto.hub_code.trim() === '') {
        throw new BadRequestException('Hub code cannot be empty');
      }

      // Check if hub_code already exists
      const existing = await this.hubRepository.findOne({
        where: { hub_code: createHubDto.hub_code.toUpperCase() },
      });

      if (existing) {
        throw new ConflictException(
          `Hub with code '${createHubDto.hub_code}' already exists`,
        );
      }

      // Check if manager phone already exists
      const existingUserByPhone = await this.usersService.findByPhone(
        createHubDto.manager_phone,
      );
      if (existingUserByPhone) {
        throw new ConflictException(
          `Phone number '${createHubDto.manager_phone}' is already registered`,
        );
      }

      // Check if manager email already exists (only if email is provided)
      if (createHubDto.manager_email) {
        const existingUserByEmail = await this.usersService.findByEmail(
          createHubDto.manager_email,
        );
        if (existingUserByEmail) {
          throw new ConflictException(
            `Email '${createHubDto.manager_email}' is already registered`,
          );
        }
      }

      // Create hub manager user account
      const hashedPassword = await this.usersService.hashPassword(
        createHubDto.manager_password,
      );
      const managerUser = await this.usersService.create({
        full_name: createHubDto.manager_name,
        phone: createHubDto.manager_phone,
        email: createHubDto.manager_email,
        password_hash: hashedPassword,
        role: UserRole.HUB_MANAGER,
        is_active: true,
      });

      this.logger.log(
        `Hub manager user created: ${managerUser.full_name} (${managerUser.phone})`,
      );

      // Create hub with manager_user_id
      const hub = this.hubRepository.create({
        ...createHubDto,
        hub_code: createHubDto.hub_code.toUpperCase(),
        manager_user_id: managerUser.id,
      });
      const savedHub = await this.hubRepository.save(hub);

      // Create hub_manager record (junction table)
      const hubManager = this.hubManagerRepository.create({
        user_id: managerUser.id,
        hub_id: savedHub.id,
      });
      await this.hubManagerRepository.save(hubManager);

      this.logger.log(
        `Hub created: ${savedHub.branch_name} (${savedHub.hub_code}) with manager ${managerUser.full_name}`,
      );

      return savedHub;
    } catch (error) {
      // Re-throw known exceptions
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Log and throw internal server error for unexpected errors
      this.logger.error(
        `Failed to create hub: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to create hub. Please try again later.',
      );
    }
  }

  async findAll(): Promise<Hub[]> {
    try {
      const hubs = await this.hubRepository.find({
        order: { created_at: 'DESC' },
      });

      this.logger.log(`Retrieved ${hubs.length} hubs`);
      return hubs;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve hubs: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve hubs. Please try again later.',
      );
    }
  }

  async findOne(id: string): Promise<Hub> {
    try {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new BadRequestException('Invalid hub ID format');
      }

      const hub = await this.hubRepository.findOne({ where: { id } });

      if (!hub) {
        throw new NotFoundException(`Hub with ID '${id}' not found`);
      }

      return hub;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to retrieve hub ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve hub. Please try again later.',
      );
    }
  }

  async update(id: string, updateHubDto: UpdateHubDto): Promise<Hub> {
    try {
      // Check if there are any fields to update
      if (Object.keys(updateHubDto).length === 0) {
        throw new BadRequestException('No fields provided for update');
      }

      const hub = await this.findOne(id);

      // Merge updates
      Object.assign(hub, updateHubDto);

      const updatedHub = await this.hubRepository.save(hub);

      this.logger.log(`Hub updated: ${updatedHub.id} (${updatedHub.hub_code})`);
      return updatedHub;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to update hub ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to update hub. Please try again later.',
      );
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const hub = await this.findOne(id);

      // Check if hub has active relationships (optional - add if needed)
      // const hasActiveRiders = await this.checkActiveRiders(hub.id);
      // if (hasActiveRiders) {
      //   throw new BadRequestException('Cannot delete hub with active riders');
      // }

      await this.hubRepository.remove(hub);

      this.logger.log(`Hub deleted: ${hub.id} (${hub.hub_code})`);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to delete hub ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to delete hub. Please try again later.',
      );
    }
  }

  /**
   * Get hub information for a hub manager by their user ID
   */
  async getMyHub(userId: string): Promise<Hub> {
    try {
      // Find hub manager record
      const hubManager = await this.hubManagerRepository.findOne({
        where: { user_id: userId },
        relations: ['hub'],
      });

      if (!hubManager) {
        throw new NotFoundException('You are not assigned to any hub');
      }

      if (!hubManager.hub) {
        throw new NotFoundException('Hub information not found');
      }

      this.logger.log(`Hub manager ${userId} retrieved hub ${hubManager.hub.id}`);
      return hubManager.hub;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to get hub for manager ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve hub information. Please try again later.',
      );
    }
  }
}
