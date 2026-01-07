import { 
  Injectable, 
  NotFoundException, 
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Logger
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, Between } from 'typeorm';
import { Hub } from './entities/hub.entity';
import { HubManager } from './entities/hub-manager.entity';
import { RiderSettlement } from './entities/rider-settlement.entity';
import { HubTransferRecord } from './entities/hub-transfer-record.entity';
import { CreateHubDto } from './dto/create-hub.dto';
import { UpdateHubDto } from './dto/update-hub.dto';
import { SettlementQueryDto } from './dto/settlement-query.dto';
import { CreateTransferRecordDto } from './dto/create-transfer-record.dto';
import { UpdateTransferRecordDto } from './dto/update-transfer-record.dto';
import { TransferRecordQueryDto } from './dto/transfer-record-query.dto';
import { UsersService } from '../users/users.service';
import { UserRole } from '../common/enums/user-role.enum';
import { SettlementStatus } from '../common/enums/settlement-status.enum';
import { TransferRecordStatus } from '../common/enums/transfer-record-status.enum';
import { Rider } from '../riders/entities/rider.entity';
import { DeliveryVerification } from '../delivery-verifications/entities/delivery-verification.entity';

@Injectable()
export class HubsService {
  private readonly logger = new Logger(HubsService.name);

  constructor(
    @InjectRepository(Hub)
    private readonly hubRepository: Repository<Hub>,
    @InjectRepository(HubManager)
    private readonly hubManagerRepository: Repository<HubManager>,
    @InjectRepository(RiderSettlement)
    private readonly riderSettlementRepository: Repository<RiderSettlement>,
    @InjectRepository(HubTransferRecord)
    private readonly hubTransferRecordRepository: Repository<HubTransferRecord>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(DeliveryVerification)
    private readonly deliveryVerificationRepository: Repository<DeliveryVerification>,
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



  async getTopMerchantStatistics (hubId:string): Promise<{
    top_merchant: Array<{
      merchant_id: string;
      merchant_name: string;
      merchant_phone: string;
      successful_parcels: number;
      total_parcels: number;
      total_transaction_amount: number;
      total_cod_collected: number;
      total_delivery_charges: number;
      net_amount: number

    }>
  }>
  
  {
    return 
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

  // ===== RIDER SETTLEMENT METHODS =====

  /**
   * Get riders list for settlement selection
   */
  async getHubRiders(hubId: string): Promise<any[]> {
    try {
      const riders = await this.riderRepository.find({
        where: { hub_id: hubId, is_active: true },
        relations: ['user'],
        order: { created_at: 'DESC' },
      });

      this.logger.log(`Retrieved ${riders.length} riders for hub ${hubId}`);

      return riders.map((rider) => ({
        id: rider.id,
        full_name: rider.user?.full_name || 'N/A',
        phone: rider.user?.phone || 'N/A',
        bike_type: rider.bike_type,
        is_active: rider.is_active,
        photo: rider.photo,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get riders for hub ${hubId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve riders. Please try again later.',
      );
    }
  }

  /**
   * Get rider settlement details
   */
  async getRiderSettlementDetails(riderId: string, hubId: string): Promise<any> {
    try {
      // Validate rider belongs to hub
      const rider = await this.riderRepository.findOne({
        where: { id: riderId, hub_id: hubId },
        relations: ['user'],
      });

      if (!rider) {
        throw new NotFoundException('Rider not found in your hub');
      }

      // Get last settlement date
      const lastSettlement = await this.riderSettlementRepository.findOne({
        where: { rider_id: riderId, hub_id: hubId },
        order: { settled_at: 'DESC' },
      });

      const periodStart = lastSettlement?.settled_at || rider.created_at;

      // Get delivery verifications since last settlement
      const deliveryVerifications = await this.deliveryVerificationRepository
        .createQueryBuilder('dv')
        .leftJoinAndSelect('dv.parcel', 'parcel')
        .where('dv.rider_id = :riderId', { riderId })
        .andWhere('dv.verification_status = :status', { status: 'COMPLETED' })
        .andWhere('dv.delivery_completed_at >= :since', { since: periodStart })
        .orderBy('dv.delivery_completed_at', 'DESC')
        .getMany();

      // Calculate totals
      const totalCollectedAmount = deliveryVerifications.reduce(
        (sum, dv) => sum + Number(dv.collected_amount || 0),
        0,
      );

      // Count by status
      const breakdown = {
        delivered: 0,
        partial_delivery: 0,
        exchange: 0,
        paid_return: 0,
        returned: 0,
      };

      const parcels = deliveryVerifications.map((dv) => {
        const status = dv.selected_status?.toLowerCase() || 'delivered';
        if (status === 'delivered') breakdown.delivered++;
        else if (status === 'partial_delivery') breakdown.partial_delivery++;
        else if (status === 'exchange') breakdown.exchange++;
        else if (status === 'paid_return') breakdown.paid_return++;
        else if (status === 'returned') breakdown.returned++;

        return {
          parcel_id: dv.parcel_id,
          tracking_number: dv.parcel?.tracking_number || 'N/A',
          status: dv.selected_status,
          collected_amount: Number(dv.collected_amount || 0),
          expected_cod_amount: Number(dv.expected_cod_amount || 0),
          amount_difference: Number(dv.amount_difference || 0),
          delivery_completed_at: dv.delivery_completed_at,
        };
      });

      const completedDeliveries = deliveryVerifications.length;
      const previousDueAmount = lastSettlement?.new_due_amount || 0;

      this.logger.log(
        `Settlement details for rider ${riderId}: ` +
          `Collected: ${totalCollectedAmount}, Deliveries: ${completedDeliveries}`,
      );

      return {
        rider_id: riderId,
        rider_name: rider.user?.full_name || 'N/A',
        rider_phone: rider.user?.phone || 'N/A',
        total_collected_amount: totalCollectedAmount,
        completed_deliveries: completedDeliveries,
        previous_due_amount: Number(previousDueAmount),
        current_due_amount: Number(previousDueAmount),
        period_start: periodStart,
        period_end: new Date(),
        breakdown,
        parcels,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to get settlement details for rider ${riderId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve settlement details. Please try again later.',
      );
    }
  }

  /**
   * Calculate settlement discrepancy (real-time preview)
   */
  async calculateSettlementDiscrepancy(
    riderId: string,
    hubId: string,
    cashReceived: number,
  ): Promise<any> {
    try {
      const details = await this.getRiderSettlementDetails(riderId, hubId);

      const totalDueToHub =
        details.total_collected_amount + details.previous_due_amount;
      const discrepancyAmount = cashReceived - totalDueToHub;
      const newDueAmount = totalDueToHub - cashReceived;

      this.logger.log(
        `Settlement calculation for rider ${riderId}: ` +
          `Collected: ${details.total_collected_amount}, ` +
          `Cash Received: ${cashReceived}, ` +
          `Discrepancy: ${discrepancyAmount}`,
      );

      return {
        rider_id: riderId,
        rider_name: details.rider_name,
        settlement_period: {
          from: details.period_start,
          to: details.period_end,
        },
        calculation: {
          total_collected_amount: details.total_collected_amount,
          previous_due_amount: details.previous_due_amount,
          total_due_to_hub: totalDueToHub,
          cash_received: cashReceived,
          discrepancy_amount: discrepancyAmount,
          new_due_amount: newDueAmount > 0 ? newDueAmount : 0,
        },
        breakdown: details.breakdown,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to calculate settlement for rider ${riderId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to calculate settlement. Please try again later.',
      );
    }
  }

  /**
   * Record settlement transaction
   */
  async recordSettlement(
    riderId: string,
    hubId: string,
    hubManagerId: string,
    cashReceived: number,
  ): Promise<RiderSettlement> {
    try {
      // Get settlement details
      const details = await this.getRiderSettlementDetails(riderId, hubId);

      // Calculate amounts
      const totalDueToHub =
        details.total_collected_amount + details.previous_due_amount;
      const discrepancyAmount = cashReceived - totalDueToHub;
      const newDueAmount = totalDueToHub - cashReceived;

      // Determine settlement status
      let settlementStatus: SettlementStatus;
      if (newDueAmount <= 0) {
        settlementStatus = SettlementStatus.COMPLETED;
      } else if (cashReceived > 0) {
        settlementStatus = SettlementStatus.PARTIAL;
      } else {
        settlementStatus = SettlementStatus.PENDING;
      }

      // Create settlement record
      const settlement = this.riderSettlementRepository.create({
        rider_id: riderId,
        hub_id: hubId,
        hub_manager_id: hubManagerId,
        total_collected_amount: details.total_collected_amount,
        cash_received: cashReceived,
        discrepancy_amount: discrepancyAmount,
        previous_due_amount: details.previous_due_amount,
        new_due_amount: newDueAmount > 0 ? newDueAmount : 0,
        completed_deliveries: details.completed_deliveries,
        delivered_count: details.breakdown.delivered,
        partial_delivery_count: details.breakdown.partial_delivery,
        exchange_count: details.breakdown.exchange,
        paid_return_count: details.breakdown.paid_return,
        returned_count: details.breakdown.returned,
        settlement_status: settlementStatus,
        period_start: details.period_start,
        period_end: details.period_end,
        settled_at: new Date(),
      });

      const savedSettlement = await this.riderSettlementRepository.save(settlement);

      this.logger.log(
        `Settlement recorded for rider ${riderId}: ` +
          `ID: ${savedSettlement.id}, ` +
          `Collected: ${details.total_collected_amount}, ` +
          `Cash: ${cashReceived}, ` +
          `Status: ${settlementStatus}`,
      );

      return savedSettlement;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to record settlement for rider ${riderId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to record settlement. Please try again later.',
      );
    }
  }

  /**
   * Get settlement history for a rider
   */
  async getRiderSettlementHistory(
    riderId: string,
    hubId: string,
    query: SettlementQueryDto,
  ): Promise<any> {
    try {
      // Validate rider belongs to hub
      const rider = await this.riderRepository.findOne({
        where: { id: riderId, hub_id: hubId },
      });

      if (!rider) {
        throw new NotFoundException('Rider not found in your hub');
      }

      const { start_date, end_date, status, page = 1, limit = 20 } = query;

      // Build query
      const queryBuilder = this.riderSettlementRepository
        .createQueryBuilder('settlement')
        .leftJoinAndSelect('settlement.hubManager', 'hubManager')
        .leftJoinAndSelect('hubManager.user', 'managerUser')
        .where('settlement.rider_id = :riderId', { riderId })
        .andWhere('settlement.hub_id = :hubId', { hubId });

      // Date filters
      if (start_date) {
        queryBuilder.andWhere('settlement.settled_at >= :start_date', {
          start_date: new Date(start_date),
        });
      }

      if (end_date) {
        queryBuilder.andWhere('settlement.settled_at <= :end_date', {
          end_date: new Date(end_date),
        });
      }

      // Status filter
      if (status) {
        queryBuilder.andWhere('settlement.settlement_status = :status', { status });
      }

      // Pagination
      const skip = (page - 1) * limit;
      queryBuilder.skip(skip).take(limit);

      // Order by most recent first
      queryBuilder.orderBy('settlement.settled_at', 'DESC');

      const [settlements, total] = await queryBuilder.getManyAndCount();

      this.logger.log(
        `Retrieved ${settlements.length} settlements for rider ${riderId}`,
      );

      return {
        settlements: settlements.map((s) => ({
          settlement_id: s.id,
          total_collected_amount: Number(s.total_collected_amount),
          cash_received: Number(s.cash_received),
          discrepancy_amount: Number(s.discrepancy_amount),
          previous_due_amount: Number(s.previous_due_amount),
          new_due_amount: Number(s.new_due_amount),
          completed_deliveries: s.completed_deliveries,
          settlement_status: s.settlement_status,
          settled_at: s.settled_at,
          settled_by: s.hubManager?.user?.full_name || 'N/A',
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to get settlement history for rider ${riderId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve settlement history. Please try again later.',
      );
    }
  }

  // ===== HUB TRANSFER RECORDS =====

  /**
   * Create transfer record
   */
  async createTransferRecord(
    hubManagerId: string,
    dto: CreateTransferRecordDto,
    file: Express.Multer.File,
  ): Promise<HubTransferRecord> {
    try {
      // Get hub manager to verify and get hub_id
      const hubManager = await this.hubManagerRepository.findOne({
        where: { id: hubManagerId },
      });

      if (!hubManager) {
        throw new NotFoundException('Hub manager not found');
      }

      // Get file info
      const fileExtension = file.mimetype.split('/')[1];
      const fileType = fileExtension === 'jpeg' ? 'jpg' : fileExtension;

      // Create transfer record
      const transferRecord = this.hubTransferRecordRepository.create({
        hub_manager_id: hubManagerId,
        hub_id: hubManager.hub_id,
        transferred_amount: dto.transferred_amount,
        admin_bank_name: dto.admin_bank_name,
        admin_bank_account_number: dto.admin_bank_account_number,
        admin_account_holder_name: dto.admin_account_holder_name,
        transaction_reference_id: dto.transaction_reference_id || null,
        notes: dto.notes || null,
        proof_file_url: `/uploads/transfer-proofs/${file.filename}`,
        proof_file_type: fileType,
        proof_file_size: file.size,
        status: TransferRecordStatus.PENDING,
      });

      const saved = await this.hubTransferRecordRepository.save(transferRecord);

      this.logger.log(
        `Transfer record created: ${saved.id} by hub manager ${hubManagerId} - Amount: ${saved.transferred_amount}`,
      );

      return saved;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to create transfer record: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to create transfer record. Please try again later.',
      );
    }
  }

  /**
   * Get hub manager's transfer records
   */
  async getHubManagerTransferRecords(
    hubManagerId: string,
    query: TransferRecordQueryDto,
  ): Promise<{ records: HubTransferRecord[]; total: number }> {
    try {
      const { status, fromDate, toDate, page = 1, limit = 10 } = query;

      const queryBuilder = this.hubTransferRecordRepository
        .createQueryBuilder('transfer')
        .leftJoinAndSelect('transfer.reviewer', 'reviewer')
        .leftJoinAndSelect('transfer.hub', 'hub')
        .where('transfer.hub_manager_id = :hubManagerId', { hubManagerId });

      if (status) {
        queryBuilder.andWhere('transfer.status = :status', { status });
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
    } catch (error) {
      this.logger.error(
        `Failed to get transfer records for hub manager ${hubManagerId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve transfer records. Please try again later.',
      );
    }
  }

  /**
   * Get single transfer record (with authorization check)
   */
  async getTransferRecordById(
    recordId: string,
    hubManagerId?: string,
  ): Promise<HubTransferRecord> {
    try {
      const queryBuilder = this.hubTransferRecordRepository
        .createQueryBuilder('transfer')
        .leftJoinAndSelect('transfer.hubManager', 'hubManager')
        .leftJoinAndSelect('hubManager.user', 'hubManagerUser')
        .leftJoinAndSelect('transfer.hub', 'hub')
        .leftJoinAndSelect('transfer.reviewer', 'reviewer')
        .where('transfer.id = :recordId', { recordId });

      if (hubManagerId) {
        queryBuilder.andWhere('transfer.hub_manager_id = :hubManagerId', {
          hubManagerId,
        });
      }

      const record = await queryBuilder.getOne();

      if (!record) {
        throw new NotFoundException('Transfer record not found');
      }

      return record;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to get transfer record ${recordId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve transfer record. Please try again later.',
      );
    }
  }

  /**
   * Update transfer record (only if PENDING)
   */
  async updateTransferRecord(
    recordId: string,
    hubManagerId: string,
    dto: UpdateTransferRecordDto,
    file?: Express.Multer.File,
  ): Promise<HubTransferRecord> {
    try {
      const record = await this.getTransferRecordById(recordId, hubManagerId);

      if (record.status !== TransferRecordStatus.PENDING) {
        throw new BadRequestException(
          'Only pending transfer records can be updated',
        );
      }

      // Update fields
      if (dto.transferred_amount !== undefined) {
        record.transferred_amount = dto.transferred_amount;
      }
      if (dto.admin_bank_name) {
        record.admin_bank_name = dto.admin_bank_name;
      }
      if (dto.admin_bank_account_number) {
        record.admin_bank_account_number = dto.admin_bank_account_number;
      }
      if (dto.admin_account_holder_name) {
        record.admin_account_holder_name = dto.admin_account_holder_name;
      }
      if (dto.transaction_reference_id !== undefined) {
        record.transaction_reference_id = dto.transaction_reference_id;
      }
      if (dto.notes !== undefined) {
        record.notes = dto.notes;
      }

      // Update file if provided
      if (file) {
        const fileExtension = file.mimetype.split('/')[1];
        const fileType = fileExtension === 'jpeg' ? 'jpg' : fileExtension;

        record.proof_file_url = `/uploads/transfer-proofs/${file.filename}`;
        record.proof_file_type = fileType;
        record.proof_file_size = file.size;
      }

      const updated = await this.hubTransferRecordRepository.save(record);

      this.logger.log(`Transfer record updated: ${updated.id}`);

      return updated;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to update transfer record ${recordId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to update transfer record. Please try again later.',
      );
    }
  }

  /**
   * Delete transfer record (only if PENDING)
   */
  async deleteTransferRecord(
    recordId: string,
    hubManagerId: string,
  ): Promise<void> {
    try {
      const record = await this.getTransferRecordById(recordId, hubManagerId);

      if (record.status !== TransferRecordStatus.PENDING) {
        throw new BadRequestException(
          'Only pending transfer records can be deleted',
        );
      }

      await this.hubTransferRecordRepository.remove(record);

      this.logger.log(
        `Transfer record deleted: ${recordId} by hub manager ${hubManagerId}`,
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to delete transfer record ${recordId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to delete transfer record. Please try again later.',
      );
    }
  }
}
