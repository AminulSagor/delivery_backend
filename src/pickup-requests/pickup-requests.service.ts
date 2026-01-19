import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, IsNull } from 'typeorm';
import { PickupRequest } from './entities/pickup-request.entity';
import { CreatePickupRequestDto } from './dto/create-pickup-request.dto';
import { UpdatePickupRequestDto } from './dto/update-pickup-request.dto';
import { PickupRequestStatus } from '../common/enums/pickup-request-status.enum';
import { Store } from '../stores/entities/store.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Rider } from '../riders/entities/rider.entity';
import { Parcel } from '../parcels/entities/parcel.entity';
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
    @InjectRepository(Parcel)
    private readonly parcelRepository: Repository<Parcel>,
  ) {}

  /**
   * Create or update pickup request manually (by merchant)
   * If a PENDING pickup request exists for today, update it instead of creating a new one
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

    // Check if there's already a pickup request for this store TODAY (using UTC for consistency)
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const existingToday = await this.pickupRequestRepository.findOne({
      where: {
        store_id: createDto.store_id,
        status: PickupRequestStatus.PENDING,
        created_at: Between(today, tomorrow),
      },
    });

    // If existing pickup request found, UPDATE it instead of creating new one
    if (existingToday) {
      this.logger.log(`[create] Found existing pickup request ${existingToday.id} for store ${createDto.store_id}, updating instead of creating new`);
      
      // Update estimated_parcels (take the max of existing and new)
      existingToday.estimated_parcels = Math.max(
        existingToday.estimated_parcels,
        createDto.estimated_parcels,
      );
      
      // Update comment if provided
      if (createDto.comment) {
        existingToday.comment = existingToday.comment 
          ? `${existingToday.comment}\n${createDto.comment}` 
          : createDto.comment;
      }
      
      return await this.pickupRequestRepository.save(existingToday);
    }

    // Create new pickup request
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
    this.logger.log(`[findOrCreateActiveForStore] Starting for store: ${storeId}, merchant: ${merchantId}`);
    
    // Check for existing pickup request TODAY (using UTC for consistency)
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const existingToday = await this.pickupRequestRepository.findOne({
      where: {
        store_id: storeId,
        status: PickupRequestStatus.PENDING,
        created_at: Between(today, tomorrow),
      },
    });

    if (existingToday) {
      this.logger.log(`[findOrCreateActiveForStore] Found existing pickup request: ${existingToday.id}`);
      return existingToday;
    }

    // Get store to get hub_id
    const store = await this.storeRepository.findOne({
      where: { id: storeId, merchant_id: merchantId },
    });

    this.logger.log(`[findOrCreateActiveForStore] Store lookup result: ${store ? `found (hub_id: ${store.hub_id})` : 'NOT FOUND'}`);

    if (!store) {
      throw new BadRequestException(
        `Store not found for id: ${storeId} and merchant: ${merchantId}`,
      );
    }

    if (!store.hub_id) {
      throw new BadRequestException(
        `Store ${store.business_name} is not assigned to a hub`,
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

    const saved = await this.pickupRequestRepository.save(pickupRequest);
    this.logger.log(`[findOrCreateActiveForStore] Created new pickup request: ${saved.id} for hub: ${store.hub_id}`);
    
    return saved;
  }

  /**
   * Link orphaned parcels (parcels without pickup_request_id) to pickup requests
   * This fixes parcels that were created when the pickup request creation failed silently
   */
  async linkOrphanedParcels(hubId: string): Promise<{ linked: number; errors: string[] }> {
    this.logger.log(`[linkOrphanedParcels] Starting for hub: ${hubId}`);
    
    const errors: string[] = [];
    let linkedCount = 0;

    // Get all stores for this hub
    const stores = await this.storeRepository.find({
      where: { hub_id: hubId },
    });

    for (const store of stores) {
      // Skip stores without hub_id
      if (!store.hub_id) {
        this.logger.warn(`[linkOrphanedParcels] Store ${store.business_name} has no hub_id, skipping`);
        continue;
      }

      // Find orphaned parcels for this store (parcels without pickup_request_id)
      const orphanedParcels = await this.parcelRepository.find({
        where: {
          store_id: store.id,
          pickup_request_id: IsNull(),
        },
      });

      if (orphanedParcels.length === 0) continue;

      this.logger.log(`[linkOrphanedParcels] Found ${orphanedParcels.length} orphaned parcels for store ${store.business_name}`);

      // Group parcels by date
      const parcelsByDate = new Map<string, typeof orphanedParcels>();
      for (const parcel of orphanedParcels) {
        const dateKey = parcel.created_at.toISOString().split('T')[0];
        if (!parcelsByDate.has(dateKey)) {
          parcelsByDate.set(dateKey, []);
        }
        parcelsByDate.get(dateKey)!.push(parcel);
      }

      // Create/find pickup request for each date and link parcels
      for (const [dateKey, parcels] of parcelsByDate) {
        try {
          // Find or create pickup request for this date
          const date = new Date(dateKey);
          const nextDay = new Date(date);
          nextDay.setDate(nextDay.getDate() + 1);

          let pickupRequest = await this.pickupRequestRepository.findOne({
            where: {
              store_id: store.id,
              created_at: Between(date, nextDay),
            },
          });

          if (!pickupRequest) {
            // Create new pickup request for this date
            // Note: hub_id is guaranteed to be non-null here due to the check at the start of the loop
            pickupRequest = this.pickupRequestRepository.create({
              merchant_id: store.merchant_id,
              store_id: store.id,
              hub_id: store.hub_id!, // Non-null assertion - verified at start of loop
              estimated_parcels: parcels.length,
              actual_parcels: parcels.length,
              status: PickupRequestStatus.PENDING,
              requested_at: date,
            });
            pickupRequest = await this.pickupRequestRepository.save(pickupRequest);
            this.logger.log(`[linkOrphanedParcels] Created pickup request ${pickupRequest.id} for date ${dateKey}`);
          }

          // Link parcels to pickup request
          for (const parcel of parcels) {
            parcel.pickup_request_id = pickupRequest.id;
            await this.parcelRepository.save(parcel);
            linkedCount++;
          }

          // Update actual parcels count
          await this.updateActualParcelsCount(pickupRequest.id);

        } catch (error) {
          const errorMsg = `Failed to link parcels for store ${store.business_name} on ${dateKey}: ${error.message}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }
    }

    this.logger.log(`[linkOrphanedParcels] Completed. Linked ${linkedCount} parcels`);
    return { linked: linkedCount, errors };
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

      // Return only essential data for hub managers
      const items = pickupRequests.map(pr => ({
        id: pr.id,
        pickup_location: pr.store?.business_address || 'N/A',
        store_name: pr.store?.business_name || 'Unknown Store',
        store_phone: pr.store?.phone_number || 'N/A',
        comment: pr.comment,
        parcel_quantity: pr.actual_parcels || pr.estimated_parcels,
        status: pr.status,
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
      .andWhere('pickup.status = :status', { status: PickupRequestStatus.PENDING })
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

    // Verify pickup is pending and not assigned
    if (pickup.status !== PickupRequestStatus.PENDING) {
      throw new BadRequestException('Pickup must be in PENDING status to assign');
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

    // Assign rider and update status to CONFIRMED
    pickup.assigned_rider_id = riderId;
    pickup.rider_assigned_at = new Date();
    pickup.status = PickupRequestStatus.CONFIRMED;
    pickup.confirmed_at = new Date();

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
