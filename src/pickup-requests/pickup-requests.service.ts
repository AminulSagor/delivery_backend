import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, IsNull, In } from 'typeorm';
import { PickupRequest } from './entities/pickup-request.entity';
import { CreatePickupRequestDto } from './dto/create-pickup-request.dto';
import { UpdatePickupRequestDto } from './dto/update-pickup-request.dto';
import { PickupRequestStatus } from '../common/enums/pickup-request-status.enum';
import { Store, StoreStatus } from '../stores/entities/store.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Rider } from '../riders/entities/rider.entity';
import { Parcel, ParcelStatus } from '../parcels/entities/parcel.entity';
import { ParcelTrackingActorType } from '../parcels/parcel-tracking.types';
import {
  PaginatedResponse,
  PaginationMeta,
} from '../common/dto/pagination.dto';

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

  private async updateParcelPickupLifecycle(
    pickupRequestId: string,
    status: ParcelStatus.OUT_FOR_PICKUP | ParcelStatus.PICKED_UP,
    actorType: ParcelTrackingActorType,
    actorId: string,
    parcelIds?: string[],
    targetPickupRequestId?: string,
  ): Promise<number> {
    if (parcelIds && parcelIds.length === 0) return 0;

    const where: FindOptionsWhere<Parcel> = {
      pickup_request_id: pickupRequestId,
    };
    if (parcelIds) where.id = In(parcelIds);

    const parcels = await this.parcelRepository.find({ where });
    if (parcelIds && parcels.length !== parcelIds.length) {
      throw new BadRequestException(
        'One or more selected parcels do not belong to this pickup request',
      );
    }

    const eligible = parcels.filter((parcel) =>
      status === ParcelStatus.OUT_FOR_PICKUP
        ? parcel.status === ParcelStatus.PENDING
        : [
            ParcelStatus.PENDING,
            ParcelStatus.OUT_FOR_PICKUP,
            ParcelStatus.PICKED_UP,
          ].includes(parcel.status),
    );
    const occurredAt = new Date();

    for (const parcel of eligible) {
      parcel.status = status;
      if (status === ParcelStatus.PICKED_UP) {
        parcel.picked_up_at = occurredAt;
      }
      if (targetPickupRequestId) {
        parcel.pickup_request_id = targetPickupRequestId;
      }
      parcel.tracking_context = {
        actor_type: actorType,
        actor_id: actorId,
        source: 'PICKUP_REQUEST',
        metadata: {
          pickup_request_id: targetPickupRequestId || pickupRequestId,
        },
      };
      await this.parcelRepository.save(parcel);
    }

    return eligible.length;
  }

  /**
   * Generate unique request code in format: REQ-2001, REQ-2002, etc.
   * Starts from 2001 and increments
   */
  private async generateRequestCode(): Promise<string> {
    const maxRetries = 5;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Get the highest existing request code
      const lastRequest = await this.pickupRequestRepository
        .createQueryBuilder('pickup')
        .where('pickup.request_code IS NOT NULL')
        .orderBy('pickup.request_code', 'DESC')
        .getOne();

      let nextNumber = 2001; // Start from 2001

      if (lastRequest?.request_code) {
        // Extract number from code like "REQ-2005"
        const match = lastRequest.request_code.match(/REQ-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      const newCode = `REQ-${nextNumber}`;

      // Check if this code already exists (race condition protection)
      const existing = await this.pickupRequestRepository.findOne({
        where: { request_code: newCode },
      });

      if (!existing) {
        return newCode;
      }

      this.logger.warn(`Request code ${newCode} already exists, retrying...`);
    }

    // Fallback: use timestamp-based code
    const timestamp = Date.now().toString().slice(-6);
    return `REQ-${timestamp}`;
  }

  /**
   * Create or update pickup request manually (by merchant)
   * - If PENDING pickup request exists for today → INCREMENT pickup_count
   * - Otherwise create new pickup request
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

    if (store.status !== StoreStatus.APPROVED) {
      throw new BadRequestException(
        'Pickup requests are unavailable because this store is not active',
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
    const today = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const existingToday = await this.pickupRequestRepository.findOne({
      where: {
        store_id: createDto.store_id,
        status: PickupRequestStatus.PENDING,
        created_at: Between(today, tomorrow),
      },
    });

    // If existing pickup request found, INCREMENT pickup_count
    if (existingToday) {
      // INCREMENT pickup_count by the specified amount (default 1)
      const incrementBy = createDto.estimated_parcels || 1;
      existingToday.estimated_parcels += incrementBy;

      this.logger.log(
        `[create] Incremented pickup_count to ${existingToday.estimated_parcels} for request: ${existingToday.id}`,
      );

      // Update comment if provided
      if (createDto.comment) {
        existingToday.comment = existingToday.comment
          ? `${existingToday.comment}\n${createDto.comment}`
          : createDto.comment;
      }

      return await this.pickupRequestRepository.save(existingToday);
    }

    // Create new pickup request with auto-generated request_code
    const requestCode = await this.generateRequestCode();

    const pickupRequest = this.pickupRequestRepository.create({
      merchant_id: merchantId,
      store_id: createDto.store_id,
      hub_id: store.hub_id,
      request_code: requestCode,
      estimated_parcels: createDto.estimated_parcels || 1,
      comment: createDto.comment || null,
      status: PickupRequestStatus.PENDING,
      requested_at: new Date(),
    });

    const saved = await this.pickupRequestRepository.save(pickupRequest);
    this.logger.log(
      `Created pickup request ${requestCode} for store ${createDto.store_id}`,
    );

    return saved;
  }

  /**
   * Find or create active pickup request for a store (for auto-linking parcels)
   * - If PENDING pickup request exists for today → increment pickup_count by 1
   * - Otherwise create new pickup request with pickup_count = 1
   */
  async findOrCreateActiveForStore(
    merchantId: string,
    storeId: string,
  ): Promise<PickupRequest> {
    this.logger.log(
      `[findOrCreateActiveForStore] Starting for store: ${storeId}, merchant: ${merchantId}`,
    );

    // Validate availability before incrementing an existing request. This prevents
    // an inactive store from creating or adding parcels to pickup work.
    const store = await this.storeRepository.findOne({
      where: { id: storeId, merchant_id: merchantId },
    });

    this.logger.log(
      `[findOrCreateActiveForStore] Store lookup result: ${store ? `found (hub_id: ${store.hub_id})` : 'NOT FOUND'}`,
    );

    if (!store) {
      throw new BadRequestException(
        `Store not found for id: ${storeId} and merchant: ${merchantId}`,
      );
    }

    if (store.status !== StoreStatus.APPROVED) {
      throw new BadRequestException(
        'Pickup requests are unavailable because this store is not active',
      );
    }

    if (!store.hub_id) {
      throw new BadRequestException(
        `Store ${store.business_name} is not assigned to a hub`,
      );
    }

    // Check for existing pickup request TODAY (using UTC for consistency)
    const now = new Date();
    const today = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
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
      // INCREMENT pickup_count (estimated_parcels) by 1
      existingToday.estimated_parcels += 1;
      const updated = await this.pickupRequestRepository.save(existingToday);
      this.logger.log(
        `[findOrCreateActiveForStore] Incremented pickup_count to ${updated.estimated_parcels} for request: ${existingToday.id}`,
      );
      return updated;
    }

    // Create new pickup request with pickup_count = 1 and auto-generated request_code
    const requestCode = await this.generateRequestCode();

    const pickupRequest = this.pickupRequestRepository.create({
      merchant_id: merchantId,
      store_id: storeId,
      hub_id: store.hub_id,
      request_code: requestCode,
      estimated_parcels: 1, // First parcel = pickup_count starts at 1
      status: PickupRequestStatus.PENDING,
      requested_at: new Date(),
    });

    const saved = await this.pickupRequestRepository.save(pickupRequest);
    this.logger.log(
      `[findOrCreateActiveForStore] Created pickup request ${requestCode} with pickup_count=1 for hub: ${store.hub_id}`,
    );

    return saved;
  }

  /**
   * Link orphaned parcels (parcels without pickup_request_id) to pickup requests
   * This fixes parcels that were created when the pickup request creation failed silently
   */
  async linkOrphanedParcels(
    hubId: string,
  ): Promise<{ linked: number; errors: string[] }> {
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
        this.logger.warn(
          `[linkOrphanedParcels] Store ${store.business_name} has no hub_id, skipping`,
        );
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

      this.logger.log(
        `[linkOrphanedParcels] Found ${orphanedParcels.length} orphaned parcels for store ${store.business_name}`,
      );

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
            // Create new pickup request for this date with auto-generated request_code
            const requestCode = await this.generateRequestCode();

            pickupRequest = this.pickupRequestRepository.create({
              merchant_id: store.merchant_id,
              store_id: store.id,
              hub_id: store.hub_id, // Non-null assertion - verified at start of loop
              request_code: requestCode,
              estimated_parcels: parcels.length,
              actual_parcels: parcels.length,
              status: PickupRequestStatus.PENDING,
              requested_at: date,
            });
            pickupRequest =
              await this.pickupRequestRepository.save(pickupRequest);
            this.logger.log(
              `[linkOrphanedParcels] Created pickup request ${requestCode} for date ${dateKey}`,
            );
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

    this.logger.log(
      `[linkOrphanedParcels] Completed. Linked ${linkedCount} parcels`,
    );
    return { linked: linkedCount, errors };
  }

  /**
   * Get all pickup requests for a merchant (with pagination)
   *
   * pickup_count = number of parcels to pick up
   */
  async findAllForMerchant(
    merchantId: string,
    page: number = 1,
    limit: number = 20,
    status?: PickupRequestStatus,
    sortBy: string = 'created_at',
    order: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedResponse<any>> {
    try {
      const where: FindOptionsWhere<PickupRequest> = {
        merchant_id: merchantId,
      };

      if (status) {
        where.status = status;
      }

      const [pickupRequests, total] =
        await this.pickupRequestRepository.findAndCount({
          where,
          relations: ['store', 'hub'],
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

      // Return simplified data with pickup_count and request_code
      const items = pickupRequests.map((pr) => ({
        id: pr.id,
        request_code: pr.request_code, // Unique code: REQ-2001
        store_name: pr.store?.business_name || 'Unknown Store',
        pickup_location: pr.store?.business_address || 'N/A',
        hub_name: pr.hub?.branch_name || 'Not Assigned',
        comment: pr.comment,
        pickup_count: pr.estimated_parcels, // Single field: how many to pick up
        status: pr.status,
        created_at: pr.created_at,
      }));

      this.logger.log(
        `Retrieved ${items.length} pickup requests for merchant ${merchantId}`,
      );

      return { items, pagination };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve pickup requests: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to retrieve pickup requests');
    }
  }

  /**
   * Get PENDING pickup requests for a hub (with pagination)
   * Returns minimal data optimized for hub managers
   *
   * Only shows PENDING status by default (pickups ready for assignment)
   */
  async findAllForHub(
    hubId: string | null,
    page: number = 1,
    limit: number = 20,
    status?: PickupRequestStatus,
    sortBy: string = 'created_at',
    order: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedResponse<any>> {
    try {
      const where: FindOptionsWhere<PickupRequest> = {
        // Default to PENDING status (pickups ready for assignment)
        status: status || PickupRequestStatus.PENDING,
      };

      // Hub filter: if hubId provided, scope to hub; otherwise system-wide (admin)
      if (hubId) {
        where.hub_id = hubId;
      }

      const [pickupRequests, total] =
        await this.pickupRequestRepository.findAndCount({
          where,
          relations: ['store'],
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

      // Return simplified data with pickup_count and request_code
      const items = pickupRequests.map((pr) => ({
        id: pr.id,
        request_code: pr.request_code, // Unique code: REQ-2001
        pickup_location: pr.store?.business_address || 'N/A',
        store_name: pr.store?.business_name || 'Unknown Store',
        store_phone: pr.store?.phone_number || 'N/A',
        comment: pr.comment,
        pickup_count: pr.estimated_parcels, // Single field: how many to pick up
        status: pr.status,
        assigned_rider_id: pr.assigned_rider_id,
      }));

      this.logger.log(
        `Retrieved ${items.length} pickup requests for hub ${hubId}`,
      );

      return { items, pagination };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve pickup requests for hub: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to retrieve pickup requests');
    }
  }

  /**
   * Get completed pickups for hub (PICKED_UP status)
   * Groups by store+date - same store on same day shows combined pickup_count
   *
   * Shows pickups that riders have completed with rider info
   */
  async getConfirmedPickupsForHub(
    hubId: string | null,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<any>> {
    try {
      const where: FindOptionsWhere<PickupRequest> = {
        status: PickupRequestStatus.PICKED_UP,
      };

      if (hubId) {
        where.hub_id = hubId;
      }

      // Get all completed pickups (we'll group them)
      const pickupRequests = await this.pickupRequestRepository.find({
        where,
        relations: ['store', 'completedByRider', 'completedByRider.user'],
        order: { picked_up_at: 'DESC' },
      });

      // Group by store+date
      const grouped = new Map<string, any>();

      for (const pr of pickupRequests) {
        const dateKey = pr.created_at.toISOString().split('T')[0]; // YYYY-MM-DD
        const key = `${pr.store_id}-${dateKey}`;

        if (grouped.has(key)) {
          // Increment pickup_count for existing entry
          const existing = grouped.get(key);
          existing.pickup_count += pr.estimated_parcels;
          existing.request_codes.push(pr.request_code);
          // Track all riders who completed pickups for this store+date
          const completedRider = pr.completedByRider;
          if (
            completedRider &&
            !existing.riders.some((r: any) => r.id === completedRider.id)
          ) {
            existing.riders.push({
              id: completedRider.id,
              name: completedRider.user?.full_name || 'Unknown',
              phone: completedRider.user?.phone || 'N/A',
            });
          }
          // Keep the latest completed_at
          if (pr.picked_up_at && pr.picked_up_at > existing.completed_at) {
            existing.completed_at = pr.picked_up_at;
          }
        } else {
          // Create new grouped entry
          grouped.set(key, {
            id: pr.id,
            request_code: pr.request_code,
            request_codes: [pr.request_code],
            pickup_location: pr.store?.business_address || 'N/A',
            store_name: pr.store?.business_name || 'Unknown Store',
            store_phone: pr.store?.phone_number || 'N/A',
            comment: pr.comment,
            pickup_count: pr.estimated_parcels,
            status: pr.status,
            rider: pr.completedByRider
              ? {
                  id: pr.completedByRider.id,
                  name: pr.completedByRider.user?.full_name || 'Unknown',
                  phone: pr.completedByRider.user?.phone || 'N/A',
                }
              : null,
            riders: pr.completedByRider
              ? [
                  {
                    id: pr.completedByRider.id,
                    name: pr.completedByRider.user?.full_name || 'Unknown',
                    phone: pr.completedByRider.user?.phone || 'N/A',
                  },
                ]
              : [],
            completed_at: pr.picked_up_at,
            date: dateKey,
          });
        }
      }

      // Convert to array and sort by completed_at DESC
      const allItems = Array.from(grouped.values()).sort(
        (a, b) =>
          new Date(b.completed_at).getTime() -
          new Date(a.completed_at).getTime(),
      );

      // Apply pagination
      const total = allItems.length;
      const totalPages = Math.ceil(total / limit);
      const items = allItems.slice((page - 1) * limit, page * limit);

      const pagination: PaginationMeta = {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };

      this.logger.log(
        `Retrieved ${items.length} grouped completed pickups for hub ${hubId}`,
      );

      return { items, pagination };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve completed pickups: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to retrieve completed pickups');
    }
  }

  /**
   * Get pickup requests accepted by riders (CONFIRMED) for hub (Hub Manager)
   *
   * Shows pickups that riders are currently going to pick up
   */
  async getAcceptedPickupsForHub(
    hubId: string | null,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<any>> {
    try {
      const skip = (page - 1) * limit;

      const where: FindOptionsWhere<PickupRequest> = {
        status: PickupRequestStatus.CONFIRMED,
      };

      // Hub filter: if hubId provided, scope to hub; otherwise system-wide (admin)
      if (hubId) {
        where.hub_id = hubId;
      }

      const [items, total] = await this.pickupRequestRepository.findAndCount({
        where,
        relations: ['store', 'merchant', 'assignedRider', 'assignedRider.user'],
        order: { rider_assigned_at: 'DESC' },
        skip,
        take: limit,
      });

      return {
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get accepted pickups for hub ${hubId}: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve accepted pickups',
      );
    }
  }

  /**
   * Get single pickup request with details
   */
  async findOne(
    id: string,
    userId?: string,
    role?: string,
  ): Promise<PickupRequest> {
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

    const saved = await this.pickupRequestRepository.save(pickupRequest);
    await this.updateParcelPickupLifecycle(
      id,
      ParcelStatus.PICKED_UP,
      ParcelTrackingActorType.HUB,
      hubId,
    );
    return saved;
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
      .andWhere('pickup.status = :status', {
        status: PickupRequestStatus.PENDING,
      })
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
      throw new BadRequestException(
        'Pickup must be in PENDING status to assign',
      );
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

    const saved = await this.pickupRequestRepository.save(pickup);
    await this.updateParcelPickupLifecycle(
      pickup.id,
      ParcelStatus.OUT_FOR_PICKUP,
      ParcelTrackingActorType.HUB,
      hubId,
    );
    return saved;
  }

  /**
   * Group pickups by store+date and aggregate pickup_count
   * If same store and same day, combine into single entry
   */
  private groupPickupsByStoreAndDate(pickups: PickupRequest[]): any[] {
    const grouped = new Map<string, any>();

    for (const pickup of pickups) {
      const dateKey = pickup.created_at.toISOString().split('T')[0]; // YYYY-MM-DD
      const key = `${pickup.store_id}-${dateKey}`;

      if (grouped.has(key)) {
        // Increment pickup_count for existing entry
        const existing = grouped.get(key);
        existing.pickup_count += pickup.estimated_parcels;
        existing.request_codes.push(pickup.request_code);
        // Keep the latest timestamp
        if (
          pickup.picked_up_at &&
          (!existing.completed_at ||
            pickup.picked_up_at > existing.completed_at)
        ) {
          existing.completed_at = pickup.picked_up_at;
        }
      } else {
        // Create new grouped entry
        grouped.set(key, {
          id: pickup.id, // Use first pickup's ID
          request_code: pickup.request_code,
          request_codes: [pickup.request_code], // Track all codes
          store_id: pickup.store_id,
          store: pickup.store,
          merchant: pickup.merchant,
          pickup_count: pickup.estimated_parcels,
          status: pickup.status,
          comment: pickup.comment,
          created_at: pickup.created_at,
          completed_at: pickup.picked_up_at,
          assigned_rider_id: pickup.assigned_rider_id,
          completed_by_rider_id: pickup.completed_by_rider_id,
        });
      }
    }

    return Array.from(grouped.values());
  }

  /**
   * Get rider's pickup requests (grouped by store+date)
   *
   * Rider Pickup Section:
   * - pending: CONFIRMED (assigned to rider, in progress)
   * - completed: PICKED_UP (completed by this rider - uses completed_by_rider_id)
   *
   * @param riderId - Rider ID
   * @param status - Specific status filter (overrides filter)
   * @param filter - Section filter: pending, completed, all
   */
  async getRiderPickups(
    riderId: string,
    status?: PickupRequestStatus,
    filter?: string,
  ) {
    let pickups: PickupRequest[] = [];

    // If specific status is provided, use it (takes priority)
    if (status) {
      pickups = await this.pickupRequestRepository.find({
        where: { assigned_rider_id: riderId, status },
        relations: ['store', 'merchant'],
        order: { requested_at: 'ASC' },
      });
    } else if (filter) {
      switch (filter) {
        case 'pending':
          // Pickup section - Pending (assigned, in progress)
          pickups = await this.pickupRequestRepository.find({
            where: {
              assigned_rider_id: riderId,
              status: PickupRequestStatus.CONFIRMED,
            },
            relations: ['store', 'merchant'],
            order: { requested_at: 'ASC' },
          });
          break;
        case 'completed':
          // Pickup section - Completed BY THIS RIDER
          pickups = await this.pickupRequestRepository.find({
            where: {
              completed_by_rider_id: riderId,
              status: PickupRequestStatus.PICKED_UP,
            },
            relations: ['store', 'merchant'],
            order: { picked_up_at: 'DESC' },
          });
          break;
        case 'all':
          // All - both assigned (in progress) and completed (by this rider)
          const assigned = await this.pickupRequestRepository.find({
            where: { assigned_rider_id: riderId },
            relations: ['store', 'merchant'],
          });
          const completed = await this.pickupRequestRepository.find({
            where: {
              completed_by_rider_id: riderId,
              status: PickupRequestStatus.PICKED_UP,
            },
            relations: ['store', 'merchant'],
          });
          pickups = [...assigned, ...completed];
          break;
        default:
          // Default: pending pickups
          pickups = await this.pickupRequestRepository.find({
            where: {
              assigned_rider_id: riderId,
              status: PickupRequestStatus.CONFIRMED,
            },
            relations: ['store', 'merchant'],
            order: { requested_at: 'ASC' },
          });
      }
    } else {
      // Default: show pending pickups
      pickups = await this.pickupRequestRepository.find({
        where: {
          assigned_rider_id: riderId,
          status: PickupRequestStatus.CONFIRMED,
        },
        relations: ['store', 'merchant'],
        order: { requested_at: 'ASC' },
      });
    }

    // Group by store+date and aggregate pickup_count
    return this.groupPickupsByStoreAndDate(pickups);
  }

  /**
   * Get single pickup request details for rider drill-down view.
   *
   * tab=pending   -> only CONFIRMED pickups assigned to this rider
   * tab=completed -> only PICKED_UP pickups completed by this rider
   * tab=all       -> either of the above
   */
  async getRiderPickupDetail(
    pickupId: string,
    riderId: string,
    tab: 'pending' | 'completed' | 'all' = 'all',
  ): Promise<PickupRequest> {
    const normalizedTab =
      tab === 'pending' || tab === 'completed' || tab === 'all' ? tab : 'all';

    const pickup = await this.pickupRequestRepository.findOne({
      where: { id: pickupId },
      relations: [
        'merchant',
        'merchant.user',
        'store',
        'store.hub',
        'store.merchant',
        'store.merchant.user',
        'hub',
        'assignedRider',
        'assignedRider.user',
        'assignedRider.hub',
        'completedByRider',
        'completedByRider.user',
        'completedByRider.hub',
        'parcels',
      ],
    });

    if (!pickup) {
      throw new NotFoundException('Pickup request not found');
    }

    const isPendingForRider =
      pickup.status === PickupRequestStatus.CONFIRMED &&
      pickup.assigned_rider_id === riderId;

    const isCompletedForRider =
      pickup.status === PickupRequestStatus.PICKED_UP &&
      pickup.completed_by_rider_id === riderId;

    if (normalizedTab === 'pending' && !isPendingForRider) {
      throw new ForbiddenException(
        'This pending pickup is not assigned to you',
      );
    }

    if (normalizedTab === 'completed' && !isCompletedForRider) {
      throw new ForbiddenException(
        'This completed pickup is not available for this rider',
      );
    }

    if (normalizedTab === 'all' && !isPendingForRider && !isCompletedForRider) {
      throw new ForbiddenException(
        'You do not have permission to view this pickup request',
      );
    }

    return pickup;
  }

  /**
   * Get finance summary pickup detail for rider.
   * Finance summary uses completed pickup events (PICKED_UP).
   */
  async getFinanceSummaryPickupDetail(
    pickupId: string,
    riderId: string,
  ): Promise<PickupRequest> {
    const pickup = await this.pickupRequestRepository.findOne({
      where: {
        id: pickupId,
        completed_by_rider_id: riderId,
        status: PickupRequestStatus.PICKED_UP,
      },
      relations: [
        'merchant',
        'merchant.user',
        'store',
        'store.hub',
        'store.merchant',
        'store.merchant.user',
        'hub',
        'assignedRider',
        'assignedRider.user',
        'assignedRider.hub',
        'completedByRider',
        'completedByRider.user',
        'completedByRider.hub',
        'parcels',
      ],
    });

    if (!pickup) {
      throw new NotFoundException(
        'Pickup request not found or not available for this rider',
      );
    }

    return pickup;
  }

  /**
   * Rider completes pickup with actual count
   *
   * Flow:
   * - If rider picks ALL parcels → original request marked as PICKED_UP
   * - If rider picks SOME parcels:
   *   - Original request: remaining parcels, status PENDING (can be reassigned)
   *   - NEW completed request: picked parcels, status PICKED_UP (for tracking)
   *
   * @param pickupId - Pickup request ID
   * @param riderId - Rider ID
   * @param pickedUpCount - How many parcels rider actually picked up
   * @param notes - Optional notes from rider
   * @returns Completed pickup request with remaining info
   */
  async riderCompletePickup(
    pickupId: string,
    riderId: string,
    pickedUpCount?: number,
    notes?: string,
    parcelIds?: string[],
  ): Promise<{ pickup: PickupRequest; remaining: number; pickedUp: number }> {
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

    const originalEstimated = pickup.estimated_parcels;

    // Use provided count or default to estimated_parcels (full pickup)
    const actualPickedCount =
      pickedUpCount !== undefined ? pickedUpCount : originalEstimated;

    // Validate picked count
    if (actualPickedCount < 0) {
      throw new BadRequestException('Picked up count cannot be negative');
    }

    if (actualPickedCount > originalEstimated) {
      throw new BadRequestException(
        `Picked up count (${actualPickedCount}) cannot exceed estimated parcels (${originalEstimated})`,
      );
    }

    if (parcelIds && parcelIds.length !== actualPickedCount) {
      throw new BadRequestException(
        'parcel_ids length must match picked_up_count',
      );
    }

    // Calculate remaining
    const remaining = originalEstimated - actualPickedCount;

    let completedPickup: PickupRequest;

    if (remaining > 0) {
      // PARTIAL PICKUP: Create completed record + update original for remaining

      // 1. Create NEW completed pickup request for picked parcels
      const completedRequestCode = await this.generateRequestCode();

      completedPickup = this.pickupRequestRepository.create({
        merchant_id: pickup.merchant_id,
        store_id: pickup.store_id,
        hub_id: pickup.hub_id,
        request_code: completedRequestCode,
        estimated_parcels: actualPickedCount,
        picked_up_count: actualPickedCount,
        status: PickupRequestStatus.PICKED_UP,
        picked_up_at: new Date(),
        completed_by_rider_id: riderId, // Track who completed it
        comment: notes
          ? `Partial pickup from ${pickup.request_code}. Rider notes: ${notes}`
          : `Partial pickup from ${pickup.request_code}`,
        requested_at: pickup.requested_at,
      });

      await this.pickupRequestRepository.save(completedPickup);

      if (parcelIds) {
        await this.updateParcelPickupLifecycle(
          pickup.id,
          ParcelStatus.PICKED_UP,
          ParcelTrackingActorType.RIDER,
          riderId,
          parcelIds,
          completedPickup.id,
        );
      }

      // 2. Update original request with remaining parcels
      pickup.estimated_parcels = remaining;
      pickup.status = PickupRequestStatus.PENDING;
      pickup.assigned_rider_id = null;
      pickup.rider_assigned_at = null;
      pickup.confirmed_at = null;

      if (notes) {
        pickup.comment = pickup.comment
          ? `${pickup.comment}\nPartial pickup by rider: ${actualPickedCount} picked, ${remaining} remaining`
          : `Partial pickup by rider: ${actualPickedCount} picked, ${remaining} remaining`;
      }

      await this.pickupRequestRepository.save(pickup);

      this.logger.log(
        `Partial pickup: Created ${completedRequestCode} for ${actualPickedCount} parcels. ` +
          `${pickup.request_code} now has ${remaining} remaining (PENDING).`,
      );
    } else {
      // FULL PICKUP: Mark original as completed
      pickup.status = PickupRequestStatus.PICKED_UP;
      pickup.picked_up_at = new Date();
      pickup.picked_up_count = actualPickedCount;
      pickup.completed_by_rider_id = riderId; // Track who completed it
      pickup.assigned_rider_id = null;
      pickup.rider_assigned_at = null;
      pickup.confirmed_at = null;

      if (notes) {
        pickup.comment = pickup.comment
          ? `${pickup.comment}\nRider notes: ${notes}`
          : `Rider notes: ${notes}`;
      }

      await this.pickupRequestRepository.save(pickup);
      await this.updateParcelPickupLifecycle(
        pickup.id,
        ParcelStatus.PICKED_UP,
        ParcelTrackingActorType.RIDER,
        riderId,
      );
      completedPickup = pickup;

      this.logger.log(
        `Full pickup: ${pickup.request_code} completed by rider ${riderId}. ` +
          `Picked: ${actualPickedCount}`,
      );
    }

    return { pickup: completedPickup, remaining, pickedUp: actualPickedCount };
  }

  /**
   * Bulk assign pickup requests to rider (Hub Manager)
   *
   * @param pickupIds - Array of pickup request IDs
   * @param riderId - Rider ID to assign
   * @param hubId - Hub Manager's hub ID
   * @returns Summary of assignment results
   */
  async bulkAssignPickupsToRider(
    pickupIds: string[],
    riderId: string,
    hubId: string | null,
    notes?: string,
  ): Promise<{
    success: number;
    failed: number;
    results: { pickupId: string; success: boolean; message: string }[];
  }> {
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

    // Verify rider belongs to the same hub (only for hub managers, not admin)
    if (hubId && rider.hub_id !== hubId) {
      throw new ForbiddenException('Rider does not belong to your hub');
    }

    const results: { pickupId: string; success: boolean; message: string }[] =
      [];
    let successCount = 0;
    let failedCount = 0;

    for (const pickupId of pickupIds) {
      try {
        const pickup = await this.pickupRequestRepository.findOne({
          where: { id: pickupId },
        });

        if (!pickup) {
          results.push({
            pickupId,
            success: false,
            message: 'Pickup request not found',
          });
          failedCount++;
          continue;
        }

        // Hub validation: only enforce for hub managers (when hubId is provided)
        if (hubId && pickup.hub_id !== hubId) {
          results.push({
            pickupId,
            success: false,
            message: 'Pickup does not belong to your hub',
          });
          failedCount++;
          continue;
        }

        if (pickup.status !== PickupRequestStatus.PENDING) {
          results.push({
            pickupId,
            success: false,
            message: `Invalid status: ${pickup.status}`,
          });
          failedCount++;
          continue;
        }

        if (pickup.assigned_rider_id) {
          results.push({
            pickupId,
            success: false,
            message: 'Already assigned to a rider',
          });
          failedCount++;
          continue;
        }

        // Assign rider
        pickup.assigned_rider_id = riderId;
        pickup.rider_assigned_at = new Date();
        pickup.status = PickupRequestStatus.CONFIRMED;
        pickup.confirmed_at = new Date();

        if (notes) {
          pickup.comment = pickup.comment
            ? `${pickup.comment}\nAssignment notes: ${notes}`
            : `Assignment notes: ${notes}`;
        }

        await this.pickupRequestRepository.save(pickup);
        await this.updateParcelPickupLifecycle(
          pickup.id,
          ParcelStatus.OUT_FOR_PICKUP,
          ParcelTrackingActorType.HUB,
          hubId || rider.hub_id,
        );
        results.push({
          pickupId,
          success: true,
          message: 'Assigned successfully',
        });
        successCount++;
      } catch (error) {
        results.push({ pickupId, success: false, message: error.message });
        failedCount++;
      }
    }

    this.logger.log(
      `Bulk assign pickups to rider ${riderId}: ${successCount} success, ${failedCount} failed`,
    );

    return { success: successCount, failed: failedCount, results };
  }

  /**
   * Get pickup requests with remaining parcels (Hub Manager)
   * Shows pickups that were partially completed and have remaining parcels to pick up
   *
   * @param hubId - Hub ID
   * @param page - Page number
   * @param limit - Items per page
   */
  async getPickupsWithRemaining(
    hubId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    // Find PICKED_UP requests where picked_up_count < estimated_parcels
    const queryBuilder = this.pickupRequestRepository
      .createQueryBuilder('pickup')
      .leftJoinAndSelect('pickup.store', 'store')
      .leftJoinAndSelect('pickup.merchant', 'merchant')
      .where('pickup.hub_id = :hubId', { hubId })
      .andWhere('pickup.status = :status', {
        status: PickupRequestStatus.PICKED_UP,
      })
      .andWhere('pickup.picked_up_count < pickup.estimated_parcels')
      .orderBy('pickup.picked_up_at', 'DESC')
      .skip(skip)
      .take(limit);

    const [pickups, total] = await queryBuilder.getManyAndCount();

    // Map with remaining count
    const items = pickups.map((p) => ({
      id: p.id,
      store_name: p.store?.business_name || 'Unknown Store',
      store_phone: p.store?.phone_number || 'N/A',
      pickup_location: p.store?.business_address || 'N/A',
      estimated_parcels: p.estimated_parcels,
      picked_up_count: p.picked_up_count,
      remaining_count: p.estimated_parcels - p.picked_up_count,
      status: p.status,
      picked_up_at: p.picked_up_at,
      comment: p.comment,
    }));

    return {
      pickups: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create new pickup request for remaining parcels (Hub Manager)
   * Use this to create a new pickup request from an existing one with remaining parcels
   *
   * @param originalPickupId - Original pickup request ID
   * @param hubId - Hub Manager's hub ID
   */
  async createPickupForRemaining(
    originalPickupId: string,
    hubId: string,
  ): Promise<PickupRequest> {
    const original = await this.pickupRequestRepository.findOne({
      where: { id: originalPickupId },
      relations: ['store'],
    });

    if (!original) {
      throw new NotFoundException('Original pickup request not found');
    }

    if (original.hub_id !== hubId) {
      throw new ForbiddenException('Pickup does not belong to your hub');
    }

    const remaining = original.estimated_parcels - original.picked_up_count;

    if (remaining <= 0) {
      throw new BadRequestException(
        'No remaining parcels to create pickup for',
      );
    }

    // Create new pickup request for remaining parcels with auto-generated request_code
    const requestCode = await this.generateRequestCode();

    const newPickup = this.pickupRequestRepository.create({
      merchant_id: original.merchant_id,
      store_id: original.store_id,
      hub_id: original.hub_id,
      request_code: requestCode,
      estimated_parcels: remaining,
      actual_parcels: 0,
      picked_up_count: 0,
      comment: `Remaining from pickup ${original.request_code || original.id}`,
      status: PickupRequestStatus.PENDING,
      requested_at: new Date(),
    });

    const saved = await this.pickupRequestRepository.save(newPickup);

    this.logger.log(
      `Created pickup ${requestCode} for ${remaining} remaining parcels from ${original.request_code || originalPickupId}`,
    );

    return saved;
  }
}
