import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  LessThanOrEqual,
  MoreThanOrEqual,
  Between,
  In,
  IsNull,
  DataSource,
} from 'typeorm';
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
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { SettlementStatus } from '../common/enums/settlement-status.enum';
import { TransferRecordStatus } from '../common/enums/transfer-record-status.enum';
import { HubStatus } from '../common/enums/hub-status.enum';
import { Rider } from '../riders/entities/rider.entity';
import { DeliveryVerification } from '../delivery-verifications/entities/delivery-verification.entity';
import { Store } from '../stores/entities/store.entity';
import {
  Parcel,
  ParcelStatus,
  PaymentStatus,
} from '../parcels/entities/parcel.entity';
import { HubExpense } from './entities/hub-expense.entity';
import { CollectCodDto } from './dto/collect-cod.dto';
import { HubManagerFinance } from './entities/hub-manager-finance.entity';
import { CreateHubExpenseDto } from './dto/create-hub-expense.dto';
import {
  FinancialReportQueryDto,
  ReportPeriod,
} from './dto/financial-report-query.dto';
import { ReviewFinanceRequestDto } from './dto/review-finance-request.dto';
import { ThirdPartyProvider } from '../third-party-providers/entities/third-party-provider.entity';
import { DeliveryProvider } from '../common/enums/delivery-provider.enum';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { AdminAccount } from 'src/admin/entities/admin-account.entity';

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
    @InjectRepository(HubExpense)
    private readonly expenseRepository: Repository<HubExpense>,
    @InjectRepository(HubManagerFinance)
    private financeRepository: Repository<HubManagerFinance>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(DeliveryVerification)
    private readonly deliveryVerificationRepository: Repository<DeliveryVerification>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(Parcel)
    private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AdminAccount)
    private adminAccountRepo: Repository<AdminAccount>,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Generate unique hub code based on area
   * Format: HUB-{AREA_CODE}-{NUMBER}
   * Example: HUB-DHK-001, HUB-CTG-002
   */
  private async generateUniqueHubCode(area: string): Promise<string> {
    // Extract first 3 letters from area and convert to uppercase
    const areaCode = area
      .replace(/[^a-zA-Z]/g, '') // Remove non-alphabetic characters
      .substring(0, 3)
      .toUpperCase()
      .padEnd(3, 'X'); // Pad with X if less than 3 chars

    // Find all existing hub codes with this area prefix
    const existingHubs = await this.hubRepository
      .createQueryBuilder('hub')
      .where('hub.hub_code LIKE :prefix', { prefix: `HUB-${areaCode}-%` })
      .orderBy('hub.hub_code', 'DESC')
      .getMany();

    let nextNumber = 1;

    if (existingHubs.length > 0) {
      // Extract the highest number from existing codes
      const numbers = existingHubs
        .map((hub) => {
          const match = hub.hub_code.match(/HUB-[A-Z]{3}-(\d+)$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((num) => !isNaN(num));

      if (numbers.length > 0) {
        nextNumber = Math.max(...numbers) + 1;
      }
    }

    // Format: HUB-DHK-001
    return `HUB-${areaCode}-${nextNumber.toString().padStart(3, '0')}`;
  }

  async create(createHubDto: CreateHubDto): Promise<Hub> {
    try {
      // Auto-generate hub_code if not provided
      let hubCode = createHubDto.hub_code;

      if (!hubCode || hubCode.trim() === '') {
        hubCode = await this.generateUniqueHubCode(createHubDto.area);
      } else {
        hubCode = hubCode.toUpperCase();

        // Check if manually provided hub_code already exists
        const existing = await this.hubRepository.findOne({
          where: { hub_code: hubCode },
        });

        if (existing) {
          throw new ConflictException(
            `Hub with code '${hubCode}' already exists`,
          );
        }
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
        hub_code: hubCode,
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
      this.logger.error(`Failed to create hub: ${error.message}`, error.stack);
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
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

      this.logger.log(
        `Hub manager ${userId} retrieved hub ${hubManager.hub.id}`,
      );
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
   * Get rider performance statistics for hub manager dashboard
   *
   * Returns overall success rate and per-rider breakdown:
   * Delivered, Rescheduled, Returned, Assigned, Commission, Success Rate
   */
  async getRiderPerformance(
    hubId: string,
    query: {
      search?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<any> {
    try {
      const page = query.page || 1;
      const limit = Math.min(query.limit || 10, 100);
      const offset = (page - 1) * limit;

      // Build date filter condition
      let dateFilter = '';
      const params: any[] = [hubId];
      let paramIndex = 2;

      if (query.startDate) {
        dateFilter += ` AND p.delivered_at >= $${paramIndex}`;
        params.push(new Date(query.startDate));
        paramIndex++;
      }
      if (query.endDate) {
        const endDate = new Date(query.endDate);
        endDate.setHours(23, 59, 59, 999);
        dateFilter += ` AND p.delivered_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      // Build search filter
      let searchFilter = '';
      if (query.search && query.search.trim()) {
        searchFilter = ` AND (u.full_name ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex})`;
        params.push(`%${query.search.trim()}%`);
        paramIndex++;
      }

      // Main query: aggregate parcel stats per rider
      const statsQuery = `
        SELECT
          r.id AS rider_id,
          u.full_name AS rider_name,
          u.phone AS rider_phone,
          r.photo,
          r.commission_per_delivery,
          COALESCE(SUM(CASE WHEN p.status IN ('DELIVERED', 'PARTIAL_DELIVERY', 'EXCHANGE') THEN 1 ELSE 0 END), 0)::int AS delivered,
          COALESCE(SUM(CASE WHEN p.status = 'DELIVERY_RESCHEDULED' THEN 1 ELSE 0 END), 0)::int AS rescheduled,
          COALESCE(SUM(CASE WHEN p.status IN ('RETURNED', 'PAID_RETURN') THEN 1 ELSE 0 END), 0)::int AS returned,
          COUNT(p.id)::int AS assigned,
          MAX(p.delivered_at) AS last_delivery_date
        FROM riders r
        INNER JOIN users u ON r.user_id = u.id
        LEFT JOIN parcels p ON p.assigned_rider_id = r.id
          AND p.status IN ('DELIVERED', 'PARTIAL_DELIVERY', 'EXCHANGE', 'DELIVERY_RESCHEDULED', 'RETURNED', 'PAID_RETURN')
          ${dateFilter}
        WHERE r.hub_id = $1
          AND r.is_active = true
          ${searchFilter}
        GROUP BY r.id, u.full_name, u.phone, r.photo, r.commission_per_delivery
        ORDER BY assigned DESC
      `;

      // Get total count
      const countQuery = `
        SELECT COUNT(*) AS total FROM (
          SELECT r.id
          FROM riders r
          INNER JOIN users u ON r.user_id = u.id
          WHERE r.hub_id = $1
            AND r.is_active = true
            ${searchFilter}
          GROUP BY r.id
        ) sub
      `;

      // Use only the params needed for count (hubId + search)
      const countParams = [hubId];
      if (query.search && query.search.trim()) {
        countParams.push(`%${query.search.trim()}%`);
      }

      const [riderStats, countResult] = await Promise.all([
        this.dataSource.query(statsQuery + ` LIMIT ${limit} OFFSET ${offset}`, params),
        this.dataSource.query(countQuery, countParams),
      ]);

      const total = parseInt(countResult[0]?.total || '0', 10);

      // Calculate per-rider stats
      const riders = riderStats.map((row: any) => {
        const delivered = parseInt(row.delivered, 10);
        const rescheduled = parseInt(row.rescheduled, 10);
        const returned = parseInt(row.returned, 10);
        const assigned = parseInt(row.assigned, 10);
        const commissionPerDelivery = Number(row.commission_per_delivery) || 0;
        const commission = Math.round(delivered * commissionPerDelivery * 100) / 100;
        const successRate = assigned > 0
          ? Math.round((delivered / assigned) * 1000) / 10
          : 0;

        return {
          rider_id: row.rider_id,
          rider_name: row.rider_name || 'N/A',
          rider_phone: row.rider_phone || 'N/A',
          photo: row.photo || null,
          delivered,
          rescheduled,
          returned,
          assigned,
          commission,
          success_rate: successRate,
          last_delivery_date: row.last_delivery_date || null,
        };
      });

      // Calculate overall stats
      const totalDelivered = riders.reduce((sum, r) => sum + r.delivered, 0);
      const totalAssigned = riders.reduce((sum, r) => sum + r.assigned, 0);
      const overallSuccessRate = totalAssigned > 0
        ? Math.round((totalDelivered / totalAssigned) * 1000) / 10
        : 0;

      this.logger.log(
        `Rider performance for hub ${hubId}: ${riders.length} riders, ` +
        `overall success rate: ${overallSuccessRate}%`,
      );

      return {
        overall_success_rate: overallSuccessRate,
        total_delivered: totalDelivered,
        total_assigned: totalAssigned,
        riders,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get rider performance for hub ${hubId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve rider performance. Please try again later.',
      );
    }
  }

  /**
   * Get rider settlement details
   */
  async getRiderSettlementDetails(
    riderId: string,
    hubId: string,
  ): Promise<any> {
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
          parcel_tx_id: dv.parcel?.parcel_tx_id || null,
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

      const savedSettlement =
        await this.riderSettlementRepository.save(settlement);

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
        queryBuilder.andWhere('settlement.settlement_status = :status', {
          status,
        });
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
  ): Promise<HubTransferRecord> {
    try {
      // 1. Verify Hub Manager
      const hubManager = await this.hubManagerRepository.findOne({
        where: { id: hubManagerId },
      });

      if (!hubManager) {
        throw new NotFoundException('Hub manager not found');
      }

      // 2. Fetch Admin Account for Snapshot
      const adminAccount = await this.adminAccountRepo.findOne({
        where: { id: dto.admin_account_id },
      });

      if (!adminAccount) {
        throw new NotFoundException('Selected Admin Account not found');
      }

      // 3. Create Transfer Record
      const transferRecord = this.hubTransferRecordRepository.create({
        hub_manager_id: hubManagerId,
        hub_id: hubManager.hub_id,
        transferred_amount: dto.transferred_amount,

        // Link to Account
        admin_account_id: adminAccount.id,

        // Snapshot Account Details (From DB, not DTO, for security/accuracy)
        admin_account_name: adminAccount.account_name,
        admin_account_number: adminAccount.account_number,
        admin_account_holder_name: adminAccount.account_holder_name,

        transaction_reference_id: dto.transaction_reference_id,
        notes: dto.notes || null,
        proof_file_url: dto.proof_file_url,

        status: TransferRecordStatus.PENDING,
      });

      const saved = await this.hubTransferRecordRepository.save(transferRecord);

      // 4. Update Hub Finance Balance (Deduct transferred amount)
      // Note: Ensure you have the finance repo injected
      const finance = await this.financeRepository.findOne({
        where: { hub_manager_id: hubManagerId },
      });
      if (finance) {
        finance.current_balance =
          Number(finance.current_balance) - dto.transferred_amount;
        finance.total_transferred_to_admin =
          Number(finance.total_transferred_to_admin) + dto.transferred_amount;
        finance.last_transfer_at = new Date();
        await this.financeRepository.save(finance);
      }

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
      const {
        status,
        fromDate,
        toDate,
        page = 1,
        limit = 10,
        hubId,
        hubManagerId: queryHubManagerId,
      } = query;

      const queryBuilder = this.hubTransferRecordRepository
        .createQueryBuilder('transfer')
        .leftJoinAndSelect('transfer.reviewer', 'reviewer')
        .leftJoinAndSelect('transfer.hub', 'hub')
        .where('transfer.hub_manager_id = :hubManagerId', { hubManagerId });

      if (status) {
        queryBuilder.andWhere('transfer.status = :status', { status });
      }

      if (hubId) {
        queryBuilder.andWhere('transfer.hub_id = :hubId', { hubId });
      }

      if (queryHubManagerId) {
        queryBuilder.andWhere('transfer.hub_manager_id = :queryHubManagerId', {
          queryHubManagerId,
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
    dto: UpdateTransferRecordDto, // Ensure this DTO exists and has optional fields
  ): Promise<HubTransferRecord> {
    try {
      const record = await this.hubTransferRecordRepository.findOne({
        where: { id: recordId, hub_manager_id: hubManagerId },
      });

      if (!record) throw new NotFoundException('Transfer record not found');

      if (record.status !== TransferRecordStatus.PENDING) {
        throw new BadRequestException(
          'Only pending transfer records can be updated',
        );
      }

      // Handle Balance Adjustment if Amount Changed
      if (
        dto.transferred_amount &&
        Number(dto.transferred_amount) !== Number(record.transferred_amount)
      ) {
        const finance = await this.financeRepository.findOne({
          where: { hub_manager_id: hubManagerId },
        });
        if (finance) {
          // Revert old amount
          finance.current_balance =
            Number(finance.current_balance) + Number(record.transferred_amount);
          finance.total_transferred_to_admin =
            Number(finance.total_transferred_to_admin) -
            Number(record.transferred_amount);

          // Deduct new amount
          finance.current_balance =
            Number(finance.current_balance) - Number(dto.transferred_amount);
          finance.total_transferred_to_admin =
            Number(finance.total_transferred_to_admin) +
            Number(dto.transferred_amount);

          await this.financeRepository.save(finance);
        }
        record.transferred_amount = dto.transferred_amount;
      }

      // Update Account Snapshot if Account Changed
      if (dto.admin_account_id) {
        const adminAccount = await this.adminAccountRepo.findOne({
          where: { id: dto.admin_account_id },
        });
        if (!adminAccount)
          throw new NotFoundException('Admin Account not found');

        record.admin_account_id = adminAccount.id;
        record.admin_account_name = adminAccount.account_name;
        record.admin_account_number = adminAccount.account_number;
        record.admin_account_holder_name = adminAccount.account_holder_name;
      }

      if (dto.transaction_reference_id !== undefined) {
        record.transaction_reference_id = dto.transaction_reference_id;
      }
      if (dto.notes !== undefined) {
        record.notes = dto.notes;
      }
      if (dto.proof_file_url) {
        record.proof_file_url = dto.proof_file_url;
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

  /**
   * Get the top merchant (by successful parcels) with their transaction details
   */
  async getTopMerchantStatistics(hubId: string): Promise<{
    top_merchant: {
      merchant_id: string;
      merchant_name: string;
      merchant_phone: string;
      successful_parcels: number;
      total_parcels: number;
      total_transaction_amount: number;
      total_cod_collected: number;
      total_delivery_charges: number;
      net_amount: number;
    } | null;
    hub_successful_parcels_total: number;
  }> {
    try {
      // Get all stores assigned to this hub
      const stores = await this.storeRepository.find({
        where: { hub_id: hubId },
        select: ['id'],
      });

      const storeIds = stores.map((store) => store.id);

      if (storeIds.length === 0) {
        return {
          top_merchant: null,
          hub_successful_parcels_total: 0,
        };
      }

      // Successful delivery statuses
      const successfulStatuses = [
        ParcelStatus.DELIVERED,
        ParcelStatus.PARTIAL_DELIVERY,
        ParcelStatus.EXCHANGE,
      ];

      // Get all parcels for this hub's stores
      const parcels = await this.parcelRepository.find({
        where: { store_id: In(storeIds) },
        select: [
          'id',
          'merchant_id',
          'status',
          'cod_collected_amount',
          'cod_amount',
          'total_charge',
        ],
      });

      // Total successful parcels for the entire hub
      const hubSuccessfulParcelsTotal = parcels.filter((p) =>
        successfulStatuses.includes(p.status),
      ).length;

      // Get unique merchant IDs
      const uniqueMerchantIds = [...new Set(parcels.map((p) => p.merchant_id))];

      // Fetch merchant user data
      const merchantUsers = await this.userRepository.find({
        where: { id: In(uniqueMerchantIds) },
        select: ['id', 'full_name', 'phone'],
      });

      // Create merchant info map
      const merchantInfoMap = new Map<string, User>();
      for (const user of merchantUsers) {
        merchantInfoMap.set(user.id, user);
      }

      // Group by merchant
      const merchantMap = new Map<
        string,
        {
          merchant_id: string;
          merchant_name: string;
          merchant_phone: string;
          successful_parcels: number;
          total_parcels: number;
          total_transaction_amount: number;
          total_cod_collected: number;
          total_delivery_charges: number;
          net_amount: number;
        }
      >();

      for (const parcel of parcels) {
        const merchantId = parcel.merchant_id;
        const merchantUser = merchantInfoMap.get(merchantId);
        const merchantName = merchantUser?.full_name || 'Unknown';
        const merchantPhone = merchantUser?.phone || 'N/A';

        if (!merchantMap.has(merchantId)) {
          merchantMap.set(merchantId, {
            merchant_id: merchantId,
            merchant_name: merchantName,
            merchant_phone: merchantPhone,
            successful_parcels: 0,
            total_parcels: 0,
            total_transaction_amount: 0,
            total_cod_collected: 0,
            total_delivery_charges: 0,
            net_amount: 0,
          });
        }

        const data = merchantMap.get(merchantId)!;
        data.total_parcels++;

        // Check if successful delivery
        if (successfulStatuses.includes(parcel.status)) {
          data.successful_parcels++;

          const codCollected = Number(
            parcel.cod_collected_amount || parcel.cod_amount || 0,
          );
          const deliveryCharge = Number(parcel.total_charge || 0);

          data.total_cod_collected += codCollected;
          data.total_delivery_charges += deliveryCharge;
          data.total_transaction_amount += codCollected;
          data.net_amount += codCollected - deliveryCharge;
        }
      }

      // Find the top merchant (only #1)
      const merchants = Array.from(merchantMap.values());

      if (merchants.length === 0) {
        return {
          top_merchant: null,
          hub_successful_parcels_total: hubSuccessfulParcelsTotal,
        };
      }

      // Sort and get only the first one
      const topMerchant = merchants.sort(
        (a, b) => b.successful_parcels - a.successful_parcels,
      )[0];

      return {
        top_merchant: {
          ...topMerchant,
          total_transaction_amount: Number(
            topMerchant.total_transaction_amount.toFixed(2),
          ),
          total_cod_collected: Number(
            topMerchant.total_cod_collected.toFixed(2),
          ),
          total_delivery_charges: Number(
            topMerchant.total_delivery_charges.toFixed(2),
          ),
          net_amount: Number(topMerchant.net_amount.toFixed(2)),
        },
        hub_successful_parcels_total: hubSuccessfulParcelsTotal,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get top merchant statistics for hub ${hubId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve top merchant statistics. Please try again later.',
      );
    }
  }

  /**
   * Get unique merchants associated with the hub's assigned stores
   * Used for the "Select Merchant" dropdown in Hub Panel
   */
  async getHubMerchants(hubId: string): Promise<any[]> {
    try {
      // 1. Find all stores assigned to this hub
      const stores = await this.storeRepository.find({
        where: { hub_id: hubId },
        relations: ['merchant', 'merchant.user'],
        select: {
          id: true,
          merchant_id: true,
          merchant: {
            id: true,
            user_id: true,
            user: {
              id: true,
              full_name: true,
              phone: true,
            },
            merchant_profile: {
              business_name: true, // Assuming this exists or getting it from Store business_name
            },
          } as any,
        },
      });

      if (!stores.length) {
        return [];
      }

      // 2. Extract unique merchants using a Map
      const merchantMap = new Map();

      for (const store of stores) {
        if (store.merchant && !merchantMap.has(store.merchant.id)) {
          merchantMap.set(store.merchant.id, {
            id: store.merchant.id,
            user_id: store.merchant.user_id,
            full_name: store.merchant.user?.full_name || 'N/A',
            phone: store.merchant.user?.phone || 'N/A',
            // If merchant has a profile with business name, or use User name
            // Note: Store entity usually holds the 'business_name' for that specific branch
          });
        }
      }

      const uniqueMerchants = Array.from(merchantMap.values());

      this.logger.log(
        `Retrieved ${uniqueMerchants.length} merchants for hub ${hubId}`,
      );

      return uniqueMerchants;
    } catch (error) {
      this.logger.error(
        `Failed to get merchants for hub ${hubId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve hub merchants. Please try again.',
      );
    }
  }

  // 1. COLLECT CASH FROM RIDER (Balance: +)
  async collectCashFromRider(
    hubManagerId: string,
    riderId: string,
    dto: CollectCodDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get Hub Manager Info - Auto-create finance record if it doesn't exist
      const hubManager = await queryRunner.manager.findOne(HubManager, {
        where: { id: hubManagerId },
      });
      if (!hubManager) {
        throw new NotFoundException('Hub Manager not found');
      }

      let managerFinance = await queryRunner.manager.findOne(
        HubManagerFinance,
        {
          where: { hub_manager_id: hubManagerId },
        },
      );

      // Auto-create finance record if missing
      if (!managerFinance) {
        this.logger.warn(
          `[AUTO-CREATE] Finance record missing for Hub Manager ${hubManagerId}. Creating now...`,
        );
        managerFinance = queryRunner.manager.create(HubManagerFinance, {
          hub_manager_id: hubManagerId,
          hub_id: hubManager.hub_id,
          current_balance: 0,
          total_collected_from_riders: 0,
          total_transferred_to_admin: 0,
        });
        managerFinance = await queryRunner.manager.save(
          HubManagerFinance,
          managerFinance,
        );
        this.logger.log(
          `[AUTO-CREATE] Finance record created successfully for Hub Manager ${hubManagerId}`,
        );
      }

      // Get all pending parcels for this rider (completed deliveries not yet cleared)
      const successfulStatuses = [
        ParcelStatus.DELIVERED,
        ParcelStatus.PARTIAL_DELIVERY,
        ParcelStatus.EXCHANGE,
        ParcelStatus.PAID_RETURN,
      ];

      const parcels = await queryRunner.manager.find(Parcel, {
        where: {
          assigned_rider_id: riderId,
          current_hub_id: managerFinance.hub_id,
          status: In(successfulStatuses),
          payment_status: PaymentStatus.COD_COLLECTED, // Rider collected from customer
          cod_cleared_at: IsNull(), // But hasn't cleared with hub yet
        },
      });

      if (parcels.length === 0) {
        throw new BadRequestException(
          'No pending deliveries found for this rider',
        );
      }

      // 3. Calculate "Total Collectable Amount" (Expected from Rider)
      let totalExpectedAmount = 0;
      const settledParcelIds: string[] = [];

      // Counters for settlement record
      let deliveredCount = 0;
      let partialCount = 0;
      let exchangeCount = 0;
      let paidReturnCount = 0;
      let returnedCount = 0;

      for (const parcel of parcels) {
        // Add to total
        // We use 'cod_collected_amount' which is what the rider actually took from customer
        totalExpectedAmount += Number(parcel.cod_collected_amount || 0);
        settledParcelIds.push(parcel.id);

        // Update Counts
        if (parcel.status === ParcelStatus.DELIVERED) deliveredCount++;
        else if (parcel.status === ParcelStatus.PARTIAL_DELIVERY)
          partialCount++;
        else if (parcel.status === ParcelStatus.EXCHANGE) exchangeCount++;
        else if (parcel.status === ParcelStatus.PAID_RETURN) paidReturnCount++;
        else if (parcel.status === ParcelStatus.RETURNED) returnedCount++;
      }

      // 4. Financial Calculations - Only add counted amount to balance
      const countedAmount = dto.counted_amount;
      const codClearedAt = new Date();

      // 5. Update Parcels Status
      // Mark as COD cleared and set timestamp
      await queryRunner.manager.update(
        Parcel,
        { id: In(settledParcelIds) },
        {
          payment_status: PaymentStatus.COD_COLLECTED,
          cod_cleared_at: codClearedAt,
        },
      );

      // 6. Update Hub Finance (Add Counted Cash to Available Balance)
      managerFinance.current_balance =
        Number(managerFinance.current_balance) + countedAmount;
      managerFinance.total_collected_from_riders =
        Number(managerFinance.total_collected_from_riders) + countedAmount;
      managerFinance.last_collection_at = codClearedAt;

      await queryRunner.manager.save(managerFinance);

      await queryRunner.commitTransaction();

      return {
        rider_id: riderId,
        parcel_count: settledParcelIds.length,
        counted_amount: countedAmount,
        cod_cleared_at: codClearedAt,
        current_balance: Number(managerFinance.current_balance),
        message: 'COD collection processed successfully',
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // 1B. COLLECT CASH FROM CARRYBEE (Third-Party Provider)
  async collectCashFromCarrybee(
    hubManagerId: string,
    providerId: string,
    dto: CollectCodDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get Hub Manager Info - Auto-create finance record if it doesn't exist
      const hubManager = await queryRunner.manager.findOne(HubManager, {
        where: { id: hubManagerId },
      });
      if (!hubManager) {
        throw new NotFoundException('Hub Manager not found');
      }

      let managerFinance = await queryRunner.manager.findOne(
        HubManagerFinance,
        {
          where: { hub_manager_id: hubManagerId },
        },
      );

      // Auto-create finance record if missing
      if (!managerFinance) {
        this.logger.warn(
          `[AUTO-CREATE] Finance record missing for Hub Manager ${hubManagerId}. Creating now...`,
        );
        managerFinance = queryRunner.manager.create(HubManagerFinance, {
          hub_manager_id: hubManagerId,
          hub_id: hubManager.hub_id,
          current_balance: 0,
          total_collected_from_riders: 0,
          total_transferred_to_admin: 0,
        });
        managerFinance = await queryRunner.manager.save(
          HubManagerFinance,
          managerFinance,
        );
        this.logger.log(
          `[AUTO-CREATE] Finance record created successfully for Hub Manager ${hubManagerId}`,
        );
      }

      // Get third-party provider info
      const provider = await queryRunner.manager.findOne(ThirdPartyProvider, {
        where: { id: providerId },
      });
      if (!provider)
        throw new NotFoundException('Third-party provider not found');

      // Get all pending parcels from Carrybee (completed deliveries not yet cleared)
      const successfulStatuses = [
        ParcelStatus.DELIVERED,
        ParcelStatus.PARTIAL_DELIVERY,
        ParcelStatus.EXCHANGE,
        ParcelStatus.PAID_RETURN,
      ];

      const parcels = await queryRunner.manager.find(Parcel, {
        where: {
          delivery_provider: DeliveryProvider.CARRYBEE,
          third_party_provider_id: providerId,
          current_hub_id: managerFinance.hub_id,
          status: In(successfulStatuses),
          payment_status: PaymentStatus.COD_COLLECTED,
          cod_cleared_at: IsNull(),
        },
      });

      if (parcels.length === 0) {
        throw new BadRequestException(
          `No pending deliveries found for ${provider.provider_name}`,
        );
      }

      // Calculate total expected amount
      let totalExpectedAmount = 0;
      const settledParcelIds: string[] = [];

      for (const parcel of parcels) {
        totalExpectedAmount += Number(parcel.cod_collected_amount || 0);
        settledParcelIds.push(parcel.id);
      }

      const countedAmount = dto.counted_amount;
      const codClearedAt = new Date();

      // Update parcels - mark as COD cleared
      await queryRunner.manager.update(
        Parcel,
        { id: In(settledParcelIds) },
        {
          cod_cleared_at: codClearedAt,
        },
      );

      // Update Hub Finance (Add Counted Cash to Available Balance)
      managerFinance.current_balance =
        Number(managerFinance.current_balance) + countedAmount;

      managerFinance.last_collection_at = codClearedAt;

      await queryRunner.manager.save(managerFinance);

      await queryRunner.commitTransaction();

      return {
        provider_id: providerId,
        provider_name: provider.provider_name,
        parcel_count: settledParcelIds.length,
        total_expected_amount: totalExpectedAmount,
        counted_amount: countedAmount,
        discrepancy: countedAmount - totalExpectedAmount,
        cod_cleared_at: codClearedAt,
        current_balance: Number(managerFinance.current_balance),
        message: `COD collected from ${provider.provider_name} successfully`,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // 2. LOG HUB EXPENSE (Balance: -)
  async createHubExpense(hubManagerId: string, dto: CreateHubExpenseDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get Hub Manager Info - Auto-create finance record if it doesn't exist
      const hubManager = await queryRunner.manager.findOne(HubManager, {
        where: { id: hubManagerId },
      });
      if (!hubManager) {
        throw new NotFoundException('Hub Manager not found');
      }

      let managerFinance = await queryRunner.manager.findOne(
        HubManagerFinance,
        {
          where: { hub_manager_id: hubManagerId },
        },
      );

      // Auto-create finance record if missing
      if (!managerFinance) {
        this.logger.warn(
          `[AUTO-CREATE] Finance record missing for Hub Manager ${hubManagerId}. Creating now...`,
        );
        managerFinance = queryRunner.manager.create(HubManagerFinance, {
          hub_manager_id: hubManagerId,
          hub_id: hubManager.hub_id,
          current_balance: 0,
          total_collected_from_riders: 0,
          total_transferred_to_admin: 0,
        });
        managerFinance = await queryRunner.manager.save(
          HubManagerFinance,
          managerFinance,
        );
        this.logger.log(
          `[AUTO-CREATE] Finance record created successfully for Hub Manager ${hubManagerId}`,
        );
      }

      // Check Balance
      if (Number(managerFinance.current_balance) < dto.amount) {
        throw new BadRequestException(
          'Insufficient balance to record this expense',
        );
      }

      // Create Expense
      const expense = queryRunner.manager.create(HubExpense, {
        hub_id: managerFinance.hub_id,
        hub_manager_id: hubManagerId,
        ...dto,
      });
      await queryRunner.manager.save(expense);

      // UPDATE BALANCE: Deduct Expense
      managerFinance.current_balance =
        Number(managerFinance.current_balance) - dto.amount;
      await queryRunner.manager.save(managerFinance);

      await queryRunner.commitTransaction();
      return expense;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // 3. TRANSFER TO ADMIN (Balance: -)
  // Re-using/Wrapping your existing CreateTransfer logic but ensuring balance update
  async createTransfer(hubManagerId: string, dto: CreateTransferRecordDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get Hub Manager Info - Auto-create finance record if it doesn't exist
      const hubManager = await queryRunner.manager.findOne(HubManager, {
        where: { id: hubManagerId },
      });
      if (!hubManager) {
        throw new NotFoundException('Hub Manager not found');
      }

      let managerFinance = await queryRunner.manager.findOne(
        HubManagerFinance,
        {
          where: { hub_manager_id: hubManagerId },
        },
      );

      // Auto-create finance record if missing
      if (!managerFinance) {
        this.logger.warn(
          `[AUTO-CREATE] Finance record missing for Hub Manager ${hubManagerId}. Creating now...`,
        );
        managerFinance = queryRunner.manager.create(HubManagerFinance, {
          hub_manager_id: hubManagerId,
          hub_id: hubManager.hub_id,
          current_balance: 0,
          total_collected_from_riders: 0,
          total_transferred_to_admin: 0,
        });
        managerFinance = await queryRunner.manager.save(
          HubManagerFinance,
          managerFinance,
        );
        this.logger.log(
          `[AUTO-CREATE] Finance record created successfully for Hub Manager ${hubManagerId}`,
        );
      }

      if (Number(managerFinance.current_balance) < dto.transferred_amount) {
        throw new BadRequestException('Insufficient balance to transfer');
      }

      const adminAccount = await this.adminAccountRepo.findOne({
        where: { id: dto.admin_account_id },
      });
      if (!adminAccount)
        throw new NotFoundException('Selected Admin Account not found');

      const transfer = queryRunner.manager.create(HubTransferRecord, {
        hub_manager_id: hubManagerId,
        hub_id: managerFinance.hub_id,
        status: TransferRecordStatus.IN_REVIEW,
        transferred_amount: dto.transferred_amount,
        admin_account_id: adminAccount.id,
        // Snapshot Bank Details
        admin_account_name: adminAccount.account_name,
        admin_account_number: adminAccount.account_number,
        admin_account_holder_name: adminAccount.account_holder_name,

        transaction_reference_id: dto.transaction_reference_id,
        proof_file_url: dto.proof_file_url,
        notes: dto.notes || '',
      });
      await queryRunner.manager.save(transfer);

      // Deduct Balance
      managerFinance.current_balance =
        Number(managerFinance.current_balance) - dto.transferred_amount;
      managerFinance.total_transferred_to_admin =
        Number(managerFinance.total_transferred_to_admin) +
        dto.transferred_amount;
      managerFinance.last_transfer_at = new Date();

      await queryRunner.manager.save(managerFinance);
      await queryRunner.commitTransaction();
      return transfer;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // 4. FINANCIAL DASHBOARD (The Top Cards)
  async getFinanceDashboard(hubManagerId: string) {
    // Get Hub Manager to fetch hub_id if finance record needs to be created
    const hubManager = await this.hubManagerRepository.findOne({
      where: { id: hubManagerId },
    });
    if (!hubManager) {
      throw new NotFoundException('Hub Manager not found');
    }

    let finance = await this.financeRepository.findOne({
      where: { hub_manager_id: hubManagerId },
    });

    // Auto-create finance record if missing
    if (!finance) {
      this.logger.warn(
        `[AUTO-CREATE] Finance record missing for Hub Manager ${hubManagerId}. Creating now...`,
      );
      finance = this.financeRepository.create({
        hub_manager_id: hubManagerId,
        hub_id: hubManager.hub_id,
        current_balance: 0,
        total_collected_from_riders: 0,
        total_transferred_to_admin: 0,
      });
      finance = await this.financeRepository.save(finance);
      this.logger.log(
        `[AUTO-CREATE] Finance record created successfully for Hub Manager ${hubManagerId}`,
      );
    }

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Expenses This Month
    const expenseResult = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'total')
      .where('expense.hub_manager_id = :id', { id: hubManagerId })
      .andWhere('expense.created_at >= :date', { date: firstDayOfMonth })
      .getRawOne();

    // Transferred This Month (Approved + Pending usually count as "Sent")
    const transferResult = await this.hubTransferRecordRepository
      .createQueryBuilder('transfer')
      .select('SUM(transfer.transferred_amount)', 'total')
      .where('transfer.hub_manager_id = :id', { id: hubManagerId })
      .andWhere('transfer.transfer_date >= :date', { date: firstDayOfMonth })
      .getRawOne();

    // Pending Transfer Total
    const pendingResult = await this.hubTransferRecordRepository
      .createQueryBuilder('transfer')
      .select('SUM(transfer.transferred_amount)', 'total')
      .where('transfer.hub_manager_id = :id', { id: hubManagerId })
      .andWhere('transfer.status = :status', {
        status: TransferRecordStatus.PENDING,
      })
      .getRawOne();

    // Lifetime Expenses
    const lifeExpenseResult = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'total')
      .where('expense.hub_manager_id = :id', { id: hubManagerId })
      .getRawOne();

    return {
      available_balance: Number(finance.current_balance),
      transferred_this_month: Number(transferResult.total || 0),
      expenses_this_month: Number(expenseResult.total || 0),
      pending_transfer: Number(pendingResult.total || 0),
      lifetime_expenses: Number(lifeExpenseResult.total || 0),
      lifetime_transferred: Number(finance.total_transferred_to_admin),
    };
  }

  // 5. GET TRANSFERS (Paginated)
  async getTransfers(hubManagerId: string, query: PaginationDto) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'created_at',
      order = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const sortableColumns: Record<string, string> = {
      created_at: 'transfer.created_at',
      transfer_date: 'transfer.transfer_date',
      transferred_amount: 'transfer.transferred_amount',
      status: 'transfer.status',
      transaction_reference_id: 'transfer.transaction_reference_id',
    };

    const sortColumn = sortableColumns[sortBy] || 'transfer.created_at';
    const sortOrder: 'ASC' | 'DESC' = order === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.hubTransferRecordRepository
      .createQueryBuilder('transfer')
      .where('transfer.hub_manager_id = :hubManagerId', { hubManagerId })
      .orderBy(sortColumn, sortOrder)
      .skip(skip)
      .take(limit);

    if (search?.trim()) {
      qb.andWhere(
        `(
          transfer.transaction_reference_id ILIKE :search OR
          transfer.notes ILIKE :search OR
          transfer.admin_account_name ILIKE :search OR
          transfer.admin_account_number ILIKE :search
        )`,
        { search: `%${search.trim()}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 6. GET TRANSFER BY ID
  async getTransferById(id: string, hubManagerId: string) {
    const transfer = await this.hubTransferRecordRepository.findOne({
      where: { id, hub_manager_id: hubManagerId }, // Ensure ownership
      relations: ['reviewer'], // Show who reviewed it
    });

    if (!transfer) throw new NotFoundException('Transfer record not found');
    return transfer;
  }

  // 7. GET EXPENSES (Paginated)
  async getExpenses(hubManagerId: string, query: PaginationDto) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'created_at',
      order = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const sortableColumns: Record<string, string> = {
      created_at: 'expense.created_at',
      updated_at: 'expense.updated_at',
      amount: 'expense.amount',
      category: 'expense.category',
      status: 'expense.status',
    };

    const sortColumn = sortableColumns[sortBy] || 'expense.created_at';
    const sortOrder: 'ASC' | 'DESC' = order === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.hub_manager_id = :hubManagerId', { hubManagerId })
      .orderBy(sortColumn, sortOrder)
      .skip(skip)
      .take(limit);

    if (search?.trim()) {
      qb.andWhere(
        `(
          expense.reason ILIKE :search OR
          expense.category::text ILIKE :search OR
          expense.status::text ILIKE :search
        )`,
        { search: `%${search.trim()}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 8. GET EXPENSE BY ID
  async getExpenseById(id: string, hubManagerId: string) {
    const expense = await this.expenseRepository.findOne({
      where: { id, hub_manager_id: hubManagerId },
      relations: ['reviewer'],
    });

    if (!expense) throw new NotFoundException('Expense record not found');
    return expense;
  }

  // 5. HISTORY (Paginated List)
  async getFinancialHistory(
    hubManagerId: string,
    query: FinancialReportQueryDto,
  ) {
    const {
      page = 1,
      limit = 10,
      period,
      type,
      search,
      sortBy = 'created_at',
      order = 'DESC',
    } = query;
    const skip = (page - 1) * limit;
    const sortOrder: 'ASC' | 'DESC' = order === 'ASC' ? 'ASC' : 'DESC';

    // Date filtering for query builder parameter binding.
    let periodStart: Date | null = null;
    const now = new Date();
    if (period === ReportPeriod.WEEKLY) {
      periodStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 7,
      );
    } else if (period === ReportPeriod.MONTHLY) {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // We need to fetch from 3 tables and merge?
    // Or just return specific type?
    // Ideally, for a unified feed, you union them.
    // For simplicity, let's just return separate arrays or allow filtering by 'type'.

    // Simplified: Fetch latest Expenses and Transfers
    const expenseSortColumns: Record<string, string> = {
      created_at: 'expense.created_at',
      updated_at: 'expense.updated_at',
      amount: 'expense.amount',
      category: 'expense.category',
      status: 'expense.status',
    };
    const transferSortColumns: Record<string, string> = {
      created_at: 'transfer.created_at',
      transfer_date: 'transfer.transfer_date',
      transferred_amount: 'transfer.transferred_amount',
      status: 'transfer.status',
      transaction_reference_id: 'transfer.transaction_reference_id',
    };
    const settlementSortColumns: Record<string, string> = {
      created_at: 'settlement.created_at',
      updated_at: 'settlement.updated_at',
      settled_at: 'settlement.settled_at',
      total_collected_amount: 'settlement.total_collected_amount',
      cash_received: 'settlement.cash_received',
      discrepancy_amount: 'settlement.discrepancy_amount',
      settlement_status: 'settlement.settlement_status',
    };

    let expenses: HubExpense[] = [];
    let expenseCount = 0;
    let transfers: HubTransferRecord[] = [];
    let transferCount = 0;
    let settlements: RiderSettlement[] = [];
    let settleCount = 0;

    const shouldIncludeExpenses = !type || type === 'EXPENSE';
    const shouldIncludeTransfers = !type || type === 'TRANSFER';
    const shouldIncludeSettlements = !type || type === 'SETTLEMENT';

    if (shouldIncludeExpenses) {
      const expenseQb = this.expenseRepository
        .createQueryBuilder('expense')
        .where('expense.hub_manager_id = :hubManagerId', { hubManagerId })
        .orderBy(expenseSortColumns[sortBy] || 'expense.created_at', sortOrder)
        .skip(skip)
        .take(limit);

      if (period !== ReportPeriod.ALL_TIME && periodStart) {
        expenseQb.andWhere('expense.created_at >= :periodStart', {
          periodStart,
        });
      }

      if (search?.trim()) {
        expenseQb.andWhere(
          `(
            expense.reason ILIKE :search OR
            expense.category::text ILIKE :search OR
            expense.status::text ILIKE :search
          )`,
          { search: `%${search.trim()}%` },
        );
      }

      [expenses, expenseCount] = await expenseQb.getManyAndCount();
    }

    if (shouldIncludeTransfers) {
      const transferQb = this.hubTransferRecordRepository
        .createQueryBuilder('transfer')
        .where('transfer.hub_manager_id = :hubManagerId', { hubManagerId })
        .orderBy(
          transferSortColumns[sortBy] || 'transfer.transfer_date',
          sortOrder,
        )
        .skip(skip)
        .take(limit);

      if (period !== ReportPeriod.ALL_TIME && periodStart) {
        transferQb.andWhere('transfer.transfer_date >= :periodStart', {
          periodStart,
        });
      }

      if (search?.trim()) {
        transferQb.andWhere(
          `(
            transfer.transaction_reference_id ILIKE :search OR
            transfer.notes ILIKE :search OR
            transfer.admin_account_name ILIKE :search OR
            transfer.admin_account_number ILIKE :search
          )`,
          { search: `%${search.trim()}%` },
        );
      }

      [transfers, transferCount] = await transferQb.getManyAndCount();
    }

    if (shouldIncludeSettlements) {
      const settlementQb = this.riderSettlementRepository
        .createQueryBuilder('settlement')
        .leftJoinAndSelect('settlement.rider', 'rider')
        .where('settlement.hub_manager_id = :hubManagerId', { hubManagerId })
        .orderBy(
          settlementSortColumns[sortBy] || 'settlement.created_at',
          sortOrder,
        )
        .skip(skip)
        .take(limit);

      if (period !== ReportPeriod.ALL_TIME && periodStart) {
        settlementQb.andWhere('settlement.created_at >= :periodStart', {
          periodStart,
        });
      }

      if (search?.trim()) {
        settlementQb.andWhere(
          `(
            settlement.settlement_status::text ILIKE :search OR
            settlement.total_collected_amount::text ILIKE :search OR
            settlement.cash_received::text ILIKE :search OR
            settlement.discrepancy_amount::text ILIKE :search
          )`,
          { search: `%${search.trim()}%` },
        );
      }

      [settlements, settleCount] = await settlementQb.getManyAndCount();
    }

    // Formatting response
    return {
      expenses: expenses,
      transfers: transfers,
      settlements: settlements,
      meta: {
        page,
        limit,
        // Simple total count logic might be complex here with 3 sources, returning individual counts
        counts: {
          expenses: expenseCount,
          transfers: transferCount,
          settlements: settleCount,
        },
      },
    };
  }

  // ==========================================
  // ADMIN READ OPERATIONS (For Approval List)
  // ==========================================

  // 1. All Transfers (Paginated)
  async getAllTransfersForAdmin(query: PaginationDto) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'created_at',
      order = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const sortableColumns: Record<string, string> = {
      created_at: 'transfer.created_at',
      transfer_date: 'transfer.transfer_date',
      transferred_amount: 'transfer.transferred_amount',
      status: 'transfer.status',
      transaction_reference_id: 'transfer.transaction_reference_id',
    };
    const sortColumn = sortableColumns[sortBy] || 'transfer.created_at';
    const sortOrder: 'ASC' | 'DESC' = order === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.hubTransferRecordRepository
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.hub', 'hub')
      .leftJoinAndSelect('transfer.hubManager', 'manager')
      .leftJoinAndSelect('manager.user', 'user')
      .orderBy(sortColumn, sortOrder)
      .skip(skip)
      .take(limit);

    if (search) {
      qb.andWhere('transfer.transaction_reference_id ILIKE :search', {
        search: `%${search}%`,
      });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 2. Single Transfer Detail
  async getTransferDetailForAdmin(id: string) {
    const transfer = await this.hubTransferRecordRepository.findOne({
      where: { id },
      relations: ['hub', 'hubManager', 'hubManager.user', 'reviewer'],
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    return transfer;
  }

  // 3. All Expenses (Paginated)
  async getAllExpensesForAdmin(query: PaginationDto) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'created_at',
      order = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const sortableColumns: Record<string, string> = {
      created_at: 'expense.created_at',
      updated_at: 'expense.updated_at',
      amount: 'expense.amount',
      category: 'expense.category',
      status: 'expense.status',
    };
    const sortColumn = sortableColumns[sortBy] || 'expense.created_at';
    const sortOrder: 'ASC' | 'DESC' = order === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoinAndSelect('expense.hub', 'hub')
      .leftJoinAndSelect('expense.hubManager', 'hubManager')
      .leftJoinAndSelect('hubManager.user', 'user')
      .orderBy(sortColumn, sortOrder)
      .skip(skip)
      .take(limit);

    if (search?.trim()) {
      qb.andWhere(
        `(
          expense.reason ILIKE :search OR
          expense.category::text ILIKE :search OR
          expense.status::text ILIKE :search
        )`,
        { search: `%${search.trim()}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 4. Single Expense Detail
  async getExpenseDetailForAdmin(id: string) {
    const expense = await this.expenseRepository.findOne({
      where: { id },
      relations: ['hub', 'hubManager', 'hubManager.user', 'reviewer'],
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  // 6. ADMIN REVIEW TRANSFER (Approve/Decline)
  async reviewTransfer(
    id: string,
    dto: ReviewFinanceRequestDto,
    adminUser: User,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transfer = await queryRunner.manager.findOne(HubTransferRecord, {
        where: { id },
        relations: ['hubManager'], // Needed to find finance record
      });

      if (!transfer) throw new NotFoundException('Transfer record not found');

      if (transfer.status !== TransferRecordStatus.IN_REVIEW) {
        throw new BadRequestException(
          `Cannot review transfer. Current status: ${transfer.status}`,
        );
      }

      // Update Transfer Status
      transfer.status = dto.status;
      transfer.reviewed_by = adminUser.id;
      transfer.reviewed_at = new Date();
      transfer.rejection_reason = dto.rejection_reason || null;

      // LOGIC: If DECLINED, we must REFUND the amount to the Hub Manager's balance.
      // Why? Because we deducted it immediately when they created the request.
      if (dto.status === TransferRecordStatus.DECLINED) {
        if (!dto.rejection_reason) {
          throw new BadRequestException(
            'Rejection reason is required when declining',
          );
        }

        const finance = await queryRunner.manager.findOne(HubManagerFinance, {
          where: { hub_manager_id: transfer.hub_manager_id },
        });

        if (finance) {
          // Revert the deduction
          finance.current_balance =
            Number(finance.current_balance) +
            Number(transfer.transferred_amount);
          // Also revert the "Total Transferred" stat since it was rejected
          finance.total_transferred_to_admin =
            Number(finance.total_transferred_to_admin) -
            Number(transfer.transferred_amount);

          await queryRunner.manager.save(finance);
        }
      }

      await queryRunner.manager.save(transfer);
      await queryRunner.commitTransaction();

      return transfer;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // 7. ADMIN REVIEW EXPENSE (Approve/Decline)
  async reviewExpense(
    id: string,
    dto: ReviewFinanceRequestDto,
    adminUser: User,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const expense = await queryRunner.manager.findOne(HubExpense, {
        where: { id },
      });

      if (!expense) throw new NotFoundException('Expense record not found');

      if (expense.status !== TransferRecordStatus.IN_REVIEW) {
        throw new BadRequestException(
          `Cannot review expense. Current status: ${expense.status}`,
        );
      }

      // Update Expense Status
      expense.status = dto.status;
      expense.reviewed_by = adminUser.id;
      expense.reviewed_at = new Date();
      expense.rejection_reason = dto.rejection_reason || null;

      // LOGIC: If DECLINED, REFUND the amount.
      if (dto.status === TransferRecordStatus.DECLINED) {
        if (!dto.rejection_reason) {
          throw new BadRequestException(
            'Rejection reason is required when declining',
          );
        }

        const finance = await queryRunner.manager.findOne(HubManagerFinance, {
          where: { hub_manager_id: expense.hub_manager_id },
        });

        if (finance) {
          // Revert the deduction
          finance.current_balance =
            Number(finance.current_balance) + Number(expense.amount);
          await queryRunner.manager.save(finance);
        }
      }

      await queryRunner.manager.save(expense);
      await queryRunner.commitTransaction();

      return expense;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get Hub Manager Finance Overview
   * Returns: Available Balance, Transferred This Month, Expenses This Month,
   * Pending Transfer, Lifetime Expenses, Lifetime Transferred
   */
  async getHubManagerFinanceOverview(userId: string) {
    // Validate userId
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    // First, find the hub manager record by user_id
    const hubManager = await this.hubManagerRepository.findOne({
      where: { user_id: userId },
    });

    if (!hubManager) {
      throw new NotFoundException('Hub Manager not found for this user');
    }

    const hubManagerId = hubManager.id;

    // Get or create the finance record
    let finance = await this.financeRepository.findOne({
      where: { hub_manager_id: hubManagerId },
    });

    // If finance record doesn't exist, create it
    if (!finance) {
      // Create finance record with zero balances
      finance = this.financeRepository.create({
        hub_manager_id: hubManagerId,
        hub_id: hubManager.hub_id,
        current_balance: 0,
        total_collected_from_riders: 0,
        total_transferred_to_admin: 0,
      });

      finance = await this.financeRepository.save(finance);
    }

    // Calculate date range for "this month"
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    // Get lifetime transferred (APPROVED transfers only - all time)
    const lifetimeTransferred = await this.hubTransferRecordRepository
      .createQueryBuilder('transfer')
      .where('transfer.hub_manager_id = :hubManagerId', { hubManagerId })
      .andWhere('transfer.status = :status', {
        status: TransferRecordStatus.APPROVED,
      })
      .select('COALESCE(SUM(transfer.transferred_amount), 0)', 'total')
      .getRawOne();

    // Get lifetime expenses (APPROVED expenses only - all time)
    const lifetimeExpenses = await this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.hub_manager_id = :hubManagerId', { hubManagerId })
      .andWhere('expense.status = :status', {
        status: TransferRecordStatus.APPROVED,
      })
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .getRawOne();

    // Calculate Available Balance
    // = Total collected from rider settlements - Total approved transfers to admin
    const totalCollectedFromRiders = Number(
      finance.total_collected_from_riders || 0,
    );
    const totalApprovedTransfers = Number(lifetimeTransferred.total || 0);
    const availableBalance = totalCollectedFromRiders - totalApprovedTransfers;

    // Get transferred this month (APPROVED transfers only)
    const transferredThisMonth = await this.hubTransferRecordRepository
      .createQueryBuilder('transfer')
      .where('transfer.hub_manager_id = :hubManagerId', { hubManagerId })
      .andWhere('transfer.status = :status', {
        status: TransferRecordStatus.APPROVED,
      })
      .andWhere('transfer.transfer_date BETWEEN :start AND :end', {
        start: startOfMonth,
        end: endOfMonth,
      })
      .select('COALESCE(SUM(transfer.transferred_amount), 0)', 'total')
      .getRawOne();

    // Get expenses this month (APPROVED expenses only)
    const expensesThisMonth = await this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.hub_manager_id = :hubManagerId', { hubManagerId })
      .andWhere('expense.status = :status', {
        status: TransferRecordStatus.APPROVED,
      })
      .andWhere('expense.created_at BETWEEN :start AND :end', {
        start: startOfMonth,
        end: endOfMonth,
      })
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .getRawOne();

    // Get pending transfer (PENDING + IN_REVIEW status - not yet approved)
    const pendingTransfer = await this.hubTransferRecordRepository
      .createQueryBuilder('transfer')
      .where('transfer.hub_manager_id = :hubManagerId', { hubManagerId })
      .andWhere('transfer.status IN (:...statuses)', {
        statuses: [
          TransferRecordStatus.PENDING,
          TransferRecordStatus.IN_REVIEW,
        ],
      })
      .select('COALESCE(SUM(transfer.transferred_amount), 0)', 'total')
      .getRawOne();

    return {
      available_balance: availableBalance,
      transferred_this_month: Number(transferredThisMonth.total || 0),
      expenses_this_month: Number(expensesThisMonth.total || 0),
      pending_transfer: Number(pendingTransfer.total || 0),
      lifetime_expenses: Number(lifetimeExpenses.total || 0),
      lifetime_transferred: Number(lifetimeTransferred.total || 0),
    };
  }

  /**
   * Deactivate hub - Temporary deactivation
   */
  async deactivate(id: string): Promise<Hub> {
    const hub = await this.findOne(id);

    // Also deactivate hub manager user if exists
    if (hub.manager_user) {
      hub.manager_user.is_active = false;
      await this.userRepository.save(hub.manager_user);
    }

    hub.is_active = false;

    console.log(
      `[HUB DEACTIVATED] Hub deactivated: ${hub.hub_code} (${hub.id})`,
    );

    return await this.hubRepository.save(hub);
  }

  /**
   * Activate hub - Reactivate temporarily deactivated hub
   */
  async activate(id: string): Promise<Hub> {
    const hub = await this.findOne(id);

    // Also activate hub manager user if exists
    if (hub.manager_user) {
      hub.manager_user.is_active = true;
      await this.userRepository.save(hub.manager_user);
    }

    hub.is_active = true;

    console.log(`[HUB ACTIVATED] Hub activated: ${hub.hub_code} (${hub.id})`);

    return await this.hubRepository.save(hub);
  }

  /**
   * Decline hub - Permanent deactivation
   */
  async decline(id: string): Promise<Hub> {
    const hub = await this.findOne(id);

    // Also deactivate hub manager user permanently if exists
    if (hub.manager_user) {
      hub.manager_user.is_active = false;
      await this.userRepository.save(hub.manager_user);
    }

    // Set hub status to REJECTED (permanent)
    hub.status = HubStatus.REJECTED;
    hub.is_active = false;

    console.log(
      `[HUB DECLINED] Hub permanently declined: ${hub.hub_code} (${hub.id})`,
    );

    return await this.hubRepository.save(hub);
  }
}
