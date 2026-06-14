import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store, StoreStatus } from './entities/store.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Hub } from '../hubs/entities/hub.entity';
import { HubManager } from '../hubs/entities/hub-manager.entity';
import { Parcel, ParcelStatus } from '../parcels/entities/parcel.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { CarrybeeApiService } from '../carrybee/carrybee-api.service';
import { CoverageAreasService } from '../coverage-areas/coverage-areas.service';

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  constructor(
    @InjectRepository(Store)
    private storesRepository: Repository<Store>,
    @InjectRepository(Merchant)
    private merchantRepository: Repository<Merchant>,
    @InjectRepository(Hub)
    private hubRepository: Repository<Hub>,
    @InjectRepository(HubManager)
    private hubManagerRepository: Repository<HubManager>,
    @InjectRepository(Parcel)
    private parcelRepository: Repository<Parcel>,
    private carrybeeApiService: CarrybeeApiService,
    private coverageAreasService: CoverageAreasService,
  ) {}

  private normalizeOptionalText(value?: string): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  /**
   * Generate unique store code from business name
   * Format: First 3 letters + 3 digit number (e.g., TSH001)
   */
  private async generateStoreCode(businessName: string): Promise<string> {
    // Extract first 3 letters from business name (uppercase)
    const prefix = businessName
      .replace(/[^A-Za-z]/g, '') // Remove non-letters
      .substring(0, 3)
      .toUpperCase()
      .padEnd(3, 'X'); // Ensure 3 characters

    // Find the highest number for this prefix
    const existingStores = await this.storesRepository
      .createQueryBuilder('store')
      .where('store.store_code LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('store.store_code', 'DESC')
      .getMany();

    let nextNumber = 1;
    if (existingStores.length > 0) {
      const lastCode = existingStores[0].store_code;
      if (lastCode) {
        const lastNumber = parseInt(lastCode.substring(3)) || 0;
        nextNumber = lastNumber + 1;
      }
    }

    // Format: PREFIX + 3-digit number (e.g., TSH001)
    return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
  }

  /**
   * Calculate performance metrics for a store
   */
  async getStorePerformance(storeId: string): Promise<{
    total_parcels: number;
    successfully_delivered: number;
    total_returns: number;
  }> {
    const parcels = await this.parcelRepository.find({
      where: { store_id: storeId },
      select: ['id', 'status'],
    });

    const successfulStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.PAID_RETURN,
    ];

    const returnStatuses = [
      ParcelStatus.RETURNED,
      ParcelStatus.PAID_RETURN,
      ParcelStatus.RETURNED_TO_HUB,
      ParcelStatus.RETURN_TO_MERCHANT,
    ];

    const successfullyDelivered = parcels.filter((p) =>
      successfulStatuses.includes(p.status),
    ).length;

    const totalReturns = parcels.filter((p) =>
      returnStatuses.includes(p.status),
    ).length;

    return {
      total_parcels: parcels.length,
      successfully_delivered: successfullyDelivered,
      total_returns: totalReturns,
    };
  }

  async create(userId: string, dto: CreateStoreDto): Promise<Store> {
    // Find the merchant by user_id
    const merchant = await this.merchantRepository.findOne({
      where: { user_id: userId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant profile not found');
    }

    // If setting as default, unset all other default flags for this merchant
    if (dto.is_default === true) {
      await this.storesRepository.update(
        { merchant_id: merchant.id, is_default: true },
        { is_default: false },
      );
    }

    // Generate unique store code
    const storeCode = await this.generateStoreCode(dto.business_name);

    const store = new Store();
    store.merchant_id = merchant.id;
    store.store_code = storeCode; // Auto-generated
    store.business_name = dto.business_name;
    store.business_address = dto.business_address;
    store.district = this.normalizeOptionalText(dto.district);
    store.thana = this.normalizeOptionalText(dto.thana);
    store.area = this.normalizeOptionalText(dto.area);
    store.phone_number = dto.phone_number;
    store.email = this.normalizeOptionalText(dto.email);
    const facebookPage =
      dto.facebook_page !== undefined ? dto.facebook_page : dto.fb;
    store.facebook_page = this.normalizeOptionalText(facebookPage);
    store.is_default = dto.is_default || false;

    // Save store with plain address
    await this.storesRepository.save(store);

    this.logger.log(
      `Store ${store.id} created with plain address.`,
    );

    console.log(
      `[STORE CREATED] Merchant ${merchant.id} created store: ${store.business_name} (${store.id})`,
    );

    return store;
  }

  async findAllByMerchant(userId: string, status?: string): Promise<any[]> {
    const merchant = await this.merchantRepository.findOne({
      where: { user_id: userId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant profile not found');
    }

    const whereClause: any = { merchant_id: merchant.id };
    if (status !== undefined && status !== null && status !== '') {
      whereClause.status = status;
    }

    const stores = await this.storesRepository.find({
      where: whereClause,
      relations: ['hub', 'merchant', 'merchant.user'],
      order: {
        is_default: 'DESC', // Default first
        created_at: 'DESC',
      },
    });

    // 2. Calculate stats for ALL stores belonging to this merchant
    // We use a raw query or QueryBuilder for performance to do a GROUP BY
    const stats = await this.storesRepository.manager
      .createQueryBuilder(Parcel, 'parcel')
      .select('parcel.store_id', 'store_id')
      .addSelect('COUNT(parcel.id)', 'total_handled')
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...deliveredStatuses) THEN 1 ELSE 0 END)`,
        'delivered_count',
      )
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...returnStatuses) THEN 1 ELSE 0 END)`,
        'return_count',
      )
      .where('parcel.merchant_id = :merchantId', { merchantId: merchant.id })
      .groupBy('parcel.store_id')
      .setParameters({
        deliveredStatuses: [
          ParcelStatus.DELIVERED,
          ParcelStatus.PARTIAL_DELIVERY,
          ParcelStatus.EXCHANGE,
          ParcelStatus.PAID_RETURN,
        ],
        returnStatuses: [
          ParcelStatus.RETURNED,
          ParcelStatus.RETURNED_TO_HUB,
          ParcelStatus.RETURN_TO_MERCHANT,
          ParcelStatus.CANCELLED,
          ParcelStatus.FAILED_DELIVERY,
        ],
      })
      .getRawMany();

    // 3. Merge stats into stores (including store_code)
    return stores.map((store) => {
      const storeStats = stats.find((s) => s.store_id === store.id) || {
        total_handled: '0',
        delivered_count: '0',
        return_count: '0',
      };

      return {
        ...store, // Existing store details (includes store_code)
        performance: {
          total_parcels_handled: parseInt(storeStats.total_handled, 10),
          successfully_delivered: parseInt(storeStats.delivered_count, 10),
          total_returns: parseInt(storeStats.return_count, 10),
        },
      };
    });
  }

  async findDefaultStore(userId: string): Promise<
    | (Store & {
        performance: {
          total_parcels_handled: number;
          successfully_delivered: number;
          total_returns: number;
        };
      })
    | null
  > {
    const merchant = await this.merchantRepository.findOne({
      where: { user_id: userId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant profile not found');
    }

    const defaultStore = await this.storesRepository.findOne({
      where: { merchant_id: merchant.id, is_default: true },
      relations: ['hub', 'merchant', 'merchant.user'],
    });

    if (!defaultStore) {
      return null;
    }

    const stats = await this.storesRepository.manager
      .createQueryBuilder(Parcel, 'parcel')
      .select('COUNT(parcel.id)', 'total_handled')
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...deliveredStatuses) THEN 1 ELSE 0 END)`,
        'delivered_count',
      )
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...returnStatuses) THEN 1 ELSE 0 END)`,
        'return_count',
      )
      // FIXED: Use 'defaultStore.id' instead of undefined 'id'
      .where('parcel.store_id = :storeId', { storeId: defaultStore.id })
      .setParameters({
        deliveredStatuses: [
          ParcelStatus.DELIVERED,
          ParcelStatus.PARTIAL_DELIVERY,
          ParcelStatus.EXCHANGE,
          ParcelStatus.PAID_RETURN,
        ],
        returnStatuses: [
          ParcelStatus.RETURNED,
          ParcelStatus.RETURNED_TO_HUB,
          ParcelStatus.RETURN_TO_MERCHANT,
          ParcelStatus.CANCELLED,
          ParcelStatus.FAILED_DELIVERY,
        ],
      })
      .getRawOne();

    return {
      ...defaultStore,
      performance: {
        total_parcels_handled: parseInt(stats.total_handled || '0', 10),
        successfully_delivered: parseInt(stats.delivered_count || '0', 10),
        total_returns: parseInt(stats.return_count || '0', 10),
      },
    };
  }

  async findOne(
    id: string,
    userId: string,
  ): Promise<
    Store & {
      performance: {
        total_parcels_handled: number;
        successfully_delivered: number;
        total_returns: number;
      };
    }
  > {
    const merchant = await this.merchantRepository.findOne({
      where: { user_id: userId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant profile not found');
    }

    const store = await this.storesRepository.findOne({
      where: { id, merchant_id: merchant.id },
      relations: ['hub', 'merchant', 'merchant.user'],
    });

    if (!store) {
      throw new NotFoundException(
        `Store with ID ${id} not found or does not belong to you`,
      );
    }

    const stats = await this.storesRepository.manager
      .createQueryBuilder(Parcel, 'parcel')
      .select('COUNT(parcel.id)', 'total_handled')
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...deliveredStatuses) THEN 1 ELSE 0 END)`,
        'delivered_count',
      )
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...returnStatuses) THEN 1 ELSE 0 END)`,
        'return_count',
      )
      .where('parcel.store_id = :storeId', { storeId: id })
      .setParameters({
        deliveredStatuses: [
          ParcelStatus.DELIVERED,
          ParcelStatus.PARTIAL_DELIVERY,
          ParcelStatus.EXCHANGE,
          ParcelStatus.PAID_RETURN,
        ],
        returnStatuses: [
          ParcelStatus.RETURNED,
          ParcelStatus.RETURNED_TO_HUB,
          ParcelStatus.RETURN_TO_MERCHANT,
          ParcelStatus.CANCELLED,
          ParcelStatus.FAILED_DELIVERY,
        ],
      })
      .getRawOne();

    return {
      ...store,
      performance: {
        total_parcels_handled: parseInt(stats.total_handled || '0', 10),
        successfully_delivered: parseInt(stats.delivered_count || '0', 10),
        total_returns: parseInt(stats.return_count || '0', 10),
      },
    };
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateStoreDto,
  ): Promise<Store> {
    const store = await this.findOne(id, userId);

    // Update only provided fields
    if (dto.business_name !== undefined)
      store.business_name = dto.business_name;
    if (dto.business_address !== undefined)
      store.business_address = dto.business_address;
    if (dto.district !== undefined)
      store.district = this.normalizeOptionalText(dto.district);
    if (dto.thana !== undefined)
      store.thana = this.normalizeOptionalText(dto.thana);
    if (dto.area !== undefined)
      store.area = this.normalizeOptionalText(dto.area);
    if (dto.phone_number !== undefined) store.phone_number = dto.phone_number;
    if (dto.email !== undefined)
      store.email = this.normalizeOptionalText(dto.email);
    if (dto.facebook_page !== undefined || dto.fb !== undefined) {
      const facebookPage =
        dto.facebook_page !== undefined ? dto.facebook_page : dto.fb;
      store.facebook_page = this.normalizeOptionalText(facebookPage);
    }
    if (dto.carrybee_city_id !== undefined)
      store.carrybee_city_id = dto.carrybee_city_id;
    if (dto.carrybee_zone_id !== undefined)
      store.carrybee_zone_id = dto.carrybee_zone_id;
    if (dto.carrybee_area_id !== undefined)
      store.carrybee_area_id = dto.carrybee_area_id;

    await this.storesRepository.save(store);

    console.log(`[STORE UPDATED] Store ${store.id} updated by user ${userId}`);

    return store;
  }

  async setAsDefault(id: string, userId: string): Promise<Store> {
    const merchant = await this.merchantRepository.findOne({
      where: { user_id: userId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant profile not found');
    }

    const store = await this.findOne(id, userId);

    // Unset all other defaults for this merchant
    await this.storesRepository.update(
      { merchant_id: merchant.id, is_default: true },
      { is_default: false },
    );

    // Set this store as default
    store.is_default = true;
    await this.storesRepository.save(store);

    console.log(
      `[STORE DEFAULT SET] Store ${store.id} set as default for merchant ${merchant.id}`,
    );

    return store;
  }

  async disableStore(
    id: string,
    userId: string,
    options?: { isAdmin?: boolean },
  ): Promise<Store> {
    let store: Store | null = null;

    if (options?.isAdmin) {
      store = await this.storesRepository.findOne({
        where: { id },
        relations: ['hub', 'merchant', 'merchant.user'],
      });

      if (!store) {
        throw new NotFoundException(`Store with ID ${id} not found`);
      }
    } else {
      store = await this.findOne(id, userId);
    }

    if (store.status === StoreStatus.DISABLED) {
      throw new BadRequestException('Store is already disabled.');
    }

    const parcelCount = await this.parcelRepository.count({
      where: { store_id: id },
    });

    if (parcelCount > 0) {
      throw new BadRequestException(
        'Cannot disable a store that already has parcels.',
      );
    }

    store.status = StoreStatus.DISABLED;
    await this.storesRepository.save(store);

    console.log(`[STORE DISABLED] Store ${store.id} disabled by user ${userId}`);

    return store;
  }

  async remove(id: string, userId: string): Promise<void> {
    const store = await this.findOne(id, userId);

    // Cannot delete default store
    if (store.is_default === true) {
      throw new BadRequestException(
        'Cannot delete default store. Set another store as default first.',
      );
    }

    await this.storesRepository.remove(store);

    console.log(`[STORE DELETED] Store ${id} deleted by user ${userId}`);
  }

  // Admin methods
  // ===== ADMIN: STORE APPROVAL =====

  async approveStore(id: string): Promise<Store> {
    const store = await this.storesRepository.findOne({ where: { id } });

    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }

    // 1. Check if already handled
    if (store.status === StoreStatus.APPROVED) {
      throw new BadRequestException('Store is already approved.');
    }
    if (store.status === StoreStatus.DECLINED) {
      throw new BadRequestException(
        'Cannot approve a store that has been declined.',
      );
    }
    if (store.status === StoreStatus.DISABLED) {
      throw new BadRequestException('Cannot approve a disabled store.');
    }

    // 2. Update status
    store.status = StoreStatus.APPROVED;
    await this.storesRepository.save(store);

    console.log(`[STORE APPROVED] Store ${id} status set to APPROVED`);
    return store;
  }

  async rejectStore(id: string): Promise<Store> {
    const store = await this.storesRepository.findOne({ where: { id } });

    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }

    // 1. Check if already handled
    if (store.status === StoreStatus.DECLINED) {
      throw new BadRequestException('Store is already declined.');
    }
    if (store.status === StoreStatus.APPROVED) {
      throw new BadRequestException(
        'Cannot decline a store that is already approved.',
      );
    }
    if (store.status === StoreStatus.DISABLED) {
      throw new BadRequestException('Cannot decline a disabled store.');
    }

    // 2. Update status
    store.status = StoreStatus.DECLINED;
    await this.storesRepository.save(store);

    console.log(`[STORE DECLINED] Store ${id} status set to DECLINED`);
    return store;
  }

  async findAllStores(
    merchantId?: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
    status?: string,
  ): Promise<{ data: any[]; total: number }> {
    const skip = (page - 1) * limit;

    const query = this.storesRepository
      .createQueryBuilder('store')
      .leftJoinAndSelect('store.merchant', 'merchant')
      .leftJoinAndSelect('merchant.user', 'user')
      .leftJoinAndSelect('store.hub', 'hub');

    if (merchantId) {
      query.andWhere('store.merchant_id = :merchantId', { merchantId });
    }

    if (status !== undefined && status !== null && status !== '') {
      query.andWhere('store.status = :status', { status });
    }

    if (search) {
      query.andWhere(
        '(store.business_name ILIKE :search OR store.store_code ILIKE :search OR user.full_name ILIKE :search OR user.phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    query.orderBy('store.created_at', 'DESC');

    const [stores, total] = await query
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // 2. Fetch aggregated stats for the paginated stores in one query
    let stats: any[] = [];
    if (stores.length > 0) {
      const storeIds = stores.map((s) => s.id);
      stats = await this.storesRepository.manager
        .createQueryBuilder(Parcel, 'parcel')
        .select('parcel.store_id', 'store_id')
        .addSelect('COUNT(parcel.id)', 'total_handled')
        .addSelect(
          `SUM(CASE WHEN parcel.status IN (:...deliveredStatuses) THEN 1 ELSE 0 END)`,
          'delivered_count',
        )
        .addSelect(
          `SUM(CASE WHEN parcel.status IN (:...returnStatuses) THEN 1 ELSE 0 END)`,
          'return_count',
        )
        .where('parcel.store_id IN (:...storeIds)', { storeIds })
        .groupBy('parcel.store_id')
        .setParameters({
          deliveredStatuses: [
            ParcelStatus.DELIVERED,
            ParcelStatus.PARTIAL_DELIVERY,
            ParcelStatus.EXCHANGE,
            ParcelStatus.PAID_RETURN,
          ],
          returnStatuses: [
            ParcelStatus.RETURNED,
            ParcelStatus.RETURNED_TO_HUB,
            ParcelStatus.RETURN_TO_MERCHANT,
            ParcelStatus.CANCELLED,
            ParcelStatus.FAILED_DELIVERY,
          ],
        })
        .getRawMany();
    }

    // 3. Merge stats into stores
    const data = stores.map((store) => {
      const storeStats = stats.find((s) => s.store_id === store.id) || {
        total_handled: '0',
        delivered_count: '0',
        return_count: '0',
      };

      return {
        ...store,
        performance: {
          total_parcels_handled: parseInt(storeStats.total_handled, 10),
          successfully_delivered: parseInt(storeStats.delivered_count, 10),
          total_returns: parseInt(storeStats.return_count, 10),
        },
      };
    });

    return { data, total };
  }

  async assignHubToStore(storeId: string, hubId: string): Promise<Store> {
    const store = await this.storesRepository.findOne({
      where: { id: storeId },
      relations: ['merchant', 'merchant.user', 'hub'],
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    const hub = await this.hubRepository.findOne({
      where: { id: hubId },
    });

    if (!hub) {
      throw new NotFoundException(`Hub with ID ${hubId} not found`);
    }

    store.hub_id = hubId;
    store.hub = hub; // Update in-memory hub object to match ID
    await this.storesRepository.save(store);

    console.log(
      `[STORE HUB ASSIGNED] Store ${store.business_name} assigned to hub ${hub.branch_name}`,
    );

    return store;
  }

  // Hub Manager methods
  async findStoresByHubManager(userId: string): Promise<any[]> {
    // Find hub manager record by user_id
    const hubManager = await this.hubManagerRepository.findOne({
      where: { user_id: userId },
      relations: ['hub'],
    });

    if (!hubManager) {
      throw new NotFoundException('Hub manager profile not found');
    }

    console.log(
      `[HUB MANAGER STORES] User ID: ${userId}, Hub ID: ${hubManager.hub_id}`,
    );

    // Find all stores assigned to this hub - include hub relation
    const stores = await this.storesRepository.find({
      where: { hub_id: hubManager.hub_id },
      relations: ['merchant', 'merchant.user', 'hub'],
      order: { created_at: 'DESC' },
    });

    console.log(
      `[HUB MANAGER STORES] Found ${stores.length} stores for hub ${hubManager.hub_id}`,
    );

    // Return full store entities for toStoreListItem mapping
    return stores;
  }
}
