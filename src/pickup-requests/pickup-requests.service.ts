import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between } from 'typeorm';
import { PickupRequest } from './entities/pickup-request.entity';
import { CreatePickupRequestDto } from './dto/create-pickup-request.dto';
import { UpdatePickupRequestDto } from './dto/update-pickup-request.dto';
import { PickupRequestStatus } from '../common/enums/pickup-request-status.enum';
import { Store } from '../stores/entities/store.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Rider } from '../riders/entities/rider.entity';
import { PaginatedResponse, PaginationMeta } from '../common/dto/pagination.dto';

@Injectable()
export class PickupRequestsService {
  private readonly logger = new Logger(PickupRequestsService.name);

  constructor(
    @InjectRepository(PickupRequest)
    private readonly pickupRequestRepository: Repository<PickupRequest>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
  ) {}

  /**
   * Create a new pickup request manually (by merchant)
   */
  async create(
    merchantId: string,
    createDto: CreatePickupRequestDto,
  ): Promise<PickupRequest> {
    // Verify store belongs to merchant
    const store = await this.storeRepository.findOne({
      where: { id: createDto.store_id, merchant_id: merchantId },
    });

    if (!store) {
      throw new NotFoundException(
        'Store not found or does not belong to this merchant',
      );
    }

    // Verify store has hub assigned
    if (!store.hub_id) {
      throw new BadRequestException(
        'Store must be assigned to a hub before creating pickup request',
      );
    }

    // Check if there's already a pickup request for this store TODAY
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingToday = await this.pickupRequestRepository.findOne({
      where: {
        store_id: createDto.store_id,
        status: PickupRequestStatus.PENDING,
        created_at: Between(today, tomorrow),
      },
    });

    if (existingToday) {
      throw new ConflictException(
        'A pickup request for today already exists for this store. Please update the existing one or wait until tomorrow.',
      );
    }

    // Create pickup request
    const pickupRequest = this.pickupRequestRepository.create({
      merchant_id: merchantId,
      store_id: createDto.store_id,
      hub_id: store.hub_id,
      estimated_parcels: createDto.estimated_parcels,
      comment: createDto.comment || null,
      status: PickupRequestStatus.PENDING,
      requested_at: new Date(),
    });

    return await this.pickupRequestRepository.save(pickupRequest);
  }

  /**
   * Find or create active pickup request for a store (for auto-linking)
   * Creates a new pickup request each day
   */
  async findOrCreateActiveForStore(
    merchantId: string,
    storeId: string,
  ): Promise<PickupRequest> {
    // Check for existing pickup request TODAY
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingToday = await this.pickupRequestRepository.findOne({
      where: {
        store_id: storeId,
        status: PickupRequestStatus.PENDING,
        created_at: Between(today, tomorrow),
      },
    });

    if (existingToday) {
      return existingToday;
    }

    // Get store to get hub_id
    const store = await this.storeRepository.findOne({
      where: { id: storeId, merchant_id: merchantId },
    });

    if (!store || !store.hub_id) {
      throw new BadRequestException(
        'Store must be assigned to a hub before creating pickup request',
      );
    }

    // Create new pickup request
    const pickupRequest = this.pickupRequestRepository.create({
      merchant_id: merchantId,
      store_id: storeId,
      hub_id: store.hub_id,
      estimated_parcels: 0, // Will be updated as parcels are added
      status: PickupRequestStatus.PENDING,
      requested_at: new Date(),
    });

    return await this.pickupRequestRepository.save(pickupRequest);
  }

  /**
   * Get all pickup requests for a merchant (with pagination)
   */
  async findAllForMerchant(
    merchantId: string,
    page: number = 1,
    limit: number = 20,
    status?: PickupRequestStatus,
    sortBy: string = 'created_at',
    order: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedResponse<PickupRequest>> {
    try {
      const where: FindOptionsWhere<PickupRequest> = { merchant_id: merchantId };
      
      if (status) {
        where.status = status;
      }

      const [items, total] = await this.pickupRequestRepository.findAndCount({
        where,
        relations: ['store', 'hub', 'parcels'],
        order: { [sortBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      });

      const totalPages = Math.ceil(total / limit);

      const pagination: PaginationMeta = {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };

      this.logger.log(`Retrieved ${items.length} pickup requests for merchant ${merchantId}`);

      return { items, pagination };
    } catch (error) {
      this.logger.error(`Failed to retrieve pickup requests: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to retrieve pickup requests');
    }
  }

  /**
   * Get all pickup requests for a hub (with pagination)
   * Returns minimal data optimized for hub managers
   */
  async findAllForHub(
    hubId: string,
    page: number = 1,
    limit: number = 20,
    status?: PickupRequestStatus,
    sortBy: string = 'created_at',
    order: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedResponse<any>> {
    try {
      const where: FindOptionsWhere<PickupRequest> = { hub_id: hubId };
      
      if (status) {
        where.status = status;
      }

      const [pickupRequests, total] = await this.pickupRequestRepository.findAndCount({
        where,
        relations: ['store', 'parcels'],
        order: { [sortBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      });

      const totalPages = Math.ceil(total / limit);

      const pagination: PaginationMeta = {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };

      // Return minimal data for hub managers
      const items = pickupRequests.map(pr => ({
        id: pr.id,
        store_name: pr.store?.business_name || 'Unknown Store',
        pickup_location: pr.store?.business_address || 'N/A',
        store_phone: pr.store?.phone_number || 'N/A',
        estimated_parcels: pr.estimated_parcels,
        actual_parcels: pr.actual_parcels,
        status: pr.status,
        comment: pr.comment,
        confirmed_at: pr.confirmed_at,
        picked_up_at: pr.picked_up_at,
        created_at: pr.created_at,
      }));

      this.logger.log(`Retrieved ${items.length} pickup requests for hub ${hubId}`);

      return { items, pagination };
    } catch (error) {
      this.logger.error(`Failed to retrieve pickup requests for hub: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to retrieve pickup requests');
    }
  }

  /**
   * Get single pickup request with details
   */
  async findOne(id: string, userId?: string, role?: string): Promise<PickupRequest> {
    const pickupRequest = await this.pickupRequestRepository.findOne({
      where: { id },
      relations: ['merchant', 'store', 'hub', 'parcels'],
    });

    if (!pickupRequest) {
      throw new NotFoundException('Pickup request not found');
    }

    // Authorization check
    if (role === 'MERCHANT' && userId) {
      const merchant = await this.merchantRepository.findOne({
        where: { user_id: userId },
      });
      if (merchant && pickupRequest.merchant_id !== merchant.id) {
        throw new ForbiddenException(
          'You do not have permission to view this pickup request',
        );
      }
    }

    return pickupRequest;
  }

  /**
   * Confirm pickup request (Hub Manager)
   */
  async confirm(id: string, hubId: string): Promise<PickupRequest> {
    const pickupRequest = await this.pickupRequestRepository.findOne({
      where: { id },
    });

    if (!pickupRequest) {
      throw new NotFoundException('Pickup request not found');
    }

    // Verify hub manager's hub matches request hub
    if (pickupRequest.hub_id !== hubId) {
      throw new ForbiddenException(
        'You can only confirm pickup requests for your assigned hub',
      );
    }

    if (pickupRequest.status !== PickupRequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot confirm pickup request with status: ${pickupRequest.status}`,
      );
    }

    pickupRequest.status = PickupRequestStatus.CONFIRMED;
    pickupRequest.confirmed_at = new Date();

    return await this.pickupRequestRepository.save(pickupRequest);
  }

  /**
   * Mark pickup request as picked up (Hub Manager)
   */
  async markAsPickedUp(id: string, hubId: string): Promise<PickupRequest> {
    const pickupRequest = await this.pickupRequestRepository.findOne({
      where: { id },
    });

    if (!pickupRequest) {
      throw new NotFoundException('Pickup request not found');
    }

    // Verify hub manager's hub matches request hub
    if (pickupRequest.hub_id !== hubId) {
      throw new ForbiddenException(
        'You can only update pickup requests for your assigned hub',
      );
    }

    if (
      pickupRequest.status !== PickupRequestStatus.PENDING &&
      pickupRequest.status !== PickupRequestStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        `Cannot mark as picked up. Current status: ${pickupRequest.status}`,
      );
    }

    pickupRequest.status = PickupRequestStatus.PICKED_UP;
    pickupRequest.picked_up_at = new Date();

    return await this.pickupRequestRepository.save(pickupRequest);
  }

  /**
   * Cancel pickup request
   */
  async cancel(
    id: string,
    userId: string,
    role: string,
    hubId?: string,
  ): Promise<PickupRequest> {
    const pickupRequest = await this.pickupRequestRepository.findOne({
      where: { id },
    });

    if (!pickupRequest) {
      throw new NotFoundException('Pickup request not found');
    }

    // Authorization check
    if (role === 'MERCHANT') {
      const merchant = await this.merchantRepository.findOne({
        where: { user_id: userId },
      });
      if (merchant && pickupRequest.merchant_id !== merchant.id) {
        throw new ForbiddenException(
          'You can only cancel your own pickup requests',
        );
      }
    } else if (role === 'HUB_MANAGER' && hubId) {
      if (pickupRequest.hub_id !== hubId) {
        throw new ForbiddenException(
          'You can only cancel pickup requests for your assigned hub',
        );
      }
    }

    if (
      pickupRequest.status === PickupRequestStatus.PICKED_UP ||
      pickupRequest.status === PickupRequestStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel pickup request with status: ${pickupRequest.status}`,
      );
    }

    pickupRequest.status = PickupRequestStatus.CANCELLED;
    pickupRequest.cancelled_at = new Date();

    return await this.pickupRequestRepository.save(pickupRequest);
  }

  /**
   * Update actual parcels count with smart increment logic
   * - If actual < estimated: Keep estimated as is
   * - If actual >= estimated: Increment estimated to match actual
   */
  async updateActualParcelsCount(id: string): Promise<void> {
    const pickupRequest = await this.pickupRequestRepository.findOne({
      where: { id },
      relations: ['parcels'],
    });

    if (pickupRequest) {
      const actualCount = pickupRequest.parcels?.length || 0;
      pickupRequest.actual_parcels = actualCount;
      
      // Smart increment: Only increase estimated if actual exceeds it
      if (actualCount > pickupRequest.estimated_parcels) {
        pickupRequest.estimated_parcels = actualCount;
      }
      
      await this.pickupRequestRepository.save(pickupRequest);
    }
  }

  /**
   * Update pickup request
   */
  async update(
    id: string,
    merchantId: string,
    updateDto: UpdatePickupRequestDto,
  ): Promise<PickupRequest> {
    const pickupRequest = await this.pickupRequestRepository.findOne({
      where: { id },
    });

    if (!pickupRequest) {
      throw new NotFoundException('Pickup request not found');
    }

    // Verify ownership
    if (pickupRequest.merchant_id !== merchantId) {
      throw new ForbiddenException(
        'You can only update your own pickup requests',
      );
    }

    // Can only update if PENDING
    if (pickupRequest.status !== PickupRequestStatus.PENDING) {
      throw new BadRequestException(
        'Can only update pickup requests with PENDING status',
      );
    }

    // Update fields
    if (updateDto.estimated_parcels !== undefined) {
      pickupRequest.estimated_parcels = updateDto.estimated_parcels;
    }
    if (updateDto.comment !== undefined) {
      pickupRequest.comment = updateDto.comment;
    }

    return await this.pickupRequestRepository.save(pickupRequest);
  }

  /**
   * Get pickup requests available for rider assignment (Hub Manager)
   */
  async getPickupsForAssignment(
    hubId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const queryBuilder = this.pickupRequestRepository
      .createQueryBuilder('pickup')
      .leftJoinAndSelect('pickup.store', 'store')
      .leftJoinAndSelect('pickup.merchant', 'merchant')
      .where('pickup.hub_id = :hubId', { hubId })
      .andWhere('pickup.status = :status', { status: PickupRequestStatus.CONFIRMED })
      .andWhere('pickup.assigned_rider_id IS NULL')
      .orderBy('pickup.requested_at', 'ASC')
      .skip(skip)
      .take(limit);

    const [pickups, total] = await queryBuilder.getManyAndCount();

    return {
      pickups,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Assign pickup request to rider (Hub Manager)
   */
  async assignPickupToRider(
    pickupId: string,
    riderId: string,
    hubId: string,
  ): Promise<PickupRequest> {
    // Find pickup request
    const pickup = await this.pickupRequestRepository.findOne({
      where: { id: pickupId },
      relations: ['store', 'merchant'],
    });

    if (!pickup) {
      throw new NotFoundException('Pickup request not found');
    }

    // Verify pickup is in the hub manager's hub
    if (pickup.hub_id !== hubId) {
      throw new ForbiddenException('You can only assign pickups from your hub');
    }

    // Verify pickup is confirmed and not assigned
    if (pickup.status !== PickupRequestStatus.CONFIRMED) {
      throw new BadRequestException('Pickup must be in CONFIRMED status to assign');
    }

    if (pickup.assigned_rider_id) {
      throw new ConflictException('Pickup is already assigned to a rider');
    }

    // Verify rider exists and is active
    const rider = await this.riderRepository.findOne({
      where: { id: riderId },
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    if (!rider.is_active) {
      throw new BadRequestException('Cannot assign to inactive rider');
    }

    // Verify rider belongs to the same hub
    if (rider.hub_id !== hubId) {
      throw new ForbiddenException('Rider does not belong to your hub');
    }

    // Assign rider
    pickup.assigned_rider_id = riderId;
    pickup.rider_assigned_at = new Date();

    this.logger.log(
      `Pickup ${pickupId} assigned to rider ${riderId} by hub ${hubId}`,
    );

    return await this.pickupRequestRepository.save(pickup);
  }

  /**
   * Get rider's assigned pickup requests
   * 
   * Rider Pickup Section:
   * - pending: CONFIRMED (assigned to rider)
   * - completed: PICKED_UP
   * 
   * @param riderId - Rider ID
   * @param status - Specific status filter (overrides filter)
   * @param filter - Section filter: pending, completed, all
   */
  async getRiderPickups(riderId: string, status?: PickupRequestStatus, filter?: string) {
    const where: FindOptionsWhere<PickupRequest> = {
      assigned_rider_id: riderId,
    };

    // If specific status is provided, use it (takes priority)
    if (status) {
      where.status = status;
    } else if (filter) {
      switch (filter) {
        case 'pending':
          // Pickup section - Pending (assigned but not picked up)
          where.status = PickupRequestStatus.CONFIRMED;
          break;
        case 'completed':
          // Pickup section - Completed
          where.status = PickupRequestStatus.PICKED_UP;
          break;
        case 'all':
          // All - no status filter
          break;
        default:
          // Default: pending pickups
          where.status = PickupRequestStatus.CONFIRMED;
      }
    } else {
      // Default: show pending pickups
      where.status = PickupRequestStatus.CONFIRMED;
    }

    const pickups = await this.pickupRequestRepository.find({
      where,
      relations: ['store', 'merchant'],
      order: { requested_at: 'ASC' },
    });

    return pickups;
  }

  /**
   * Rider completes pickup
   */
  async riderCompletePickup(
    pickupId: string,
    riderId: string,
  ): Promise<PickupRequest> {
    // Find pickup request
    const pickup = await this.pickupRequestRepository.findOne({
      where: { id: pickupId },
      relations: ['store', 'merchant'],
    });

    if (!pickup) {
      throw new NotFoundException('Pickup request not found');
    }

    // Verify pickup is assigned to this rider
    if (pickup.assigned_rider_id !== riderId) {
      throw new ForbiddenException('This pickup is not assigned to you');
    }

    // Verify pickup is in CONFIRMED status
    if (pickup.status !== PickupRequestStatus.CONFIRMED) {
      throw new BadRequestException(
        'Only CONFIRMED pickups can be marked as completed',
      );
    }

    // Mark as picked up
    pickup.status = PickupRequestStatus.PICKED_UP;
    pickup.picked_up_at = new Date();

    this.logger.log(`Pickup ${pickupId} completed by rider ${riderId}`);

    return await this.pickupRequestRepository.save(pickup);
  }
}
