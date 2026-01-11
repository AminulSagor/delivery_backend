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
    store.district = dto.district ?? null;
    store.thana = dto.thana ?? null;
    store.area = dto.area ?? null;
    store.phone_number = dto.phone_number;
    store.email = dto.email ?? null;
    store.facebook_page = dto.facebook_page ?? null;
    store.is_default = dto.is_default || false;
    store.carrybee_city_id = dto.carrybee_city_id;
    store.carrybee_zone_id = dto.carrybee_zone_id;
    store.carrybee_area_id = dto.carrybee_area_id;

    // Validate location IDs against coverage_areas table
    const isValidLocation = await this.coverageAreasService.validateLocationIds(
      dto.carrybee_city_id,
      dto.carrybee_zone_id,
      dto.carrybee_area_id,
    );

    if (!isValidLocation) {
      throw new BadRequestException(
        'Invalid location IDs. Please select valid city, zone, and area from coverage areas.',
      );
    }

    // Save store first
    await this.storesRepository.save(store);

    // Auto-create store in Carrybee
    try {
      this.logger.log(`Creating store ${store.id} in Carrybee...`);

      // Load merchant with user relation if not loaded
      const merchantWithUser = await this.merchantRepository.findOne({
        where: { id: merchant.id },
        relations: ['user'],
      });

      const contactPersonName =
        merchantWithUser?.user?.full_name || 'Store Owner';
      const contactPhone = this.carrybeeApiService.formatPhoneForCarrybee(
        store.phone_number,
      );

      // Carrybee truncates name to 30 chars
      const truncatedName = store.business_name.substring(0, 30).trim();

      // First check if store already exists in Carrybee (by name)
      const existingStores = await this.carrybeeApiService.getStores();
      let carrybeeStore = existingStores.find(
        (s: any) => s.name === store.business_name || s.name === truncatedName,
      );

      if (!carrybeeStore) {
        // Create store in Carrybee
        this.logger.log(`Creating new store in Carrybee: ${truncatedName}`);

        await this.carrybeeApiService.createStore({
          name: store.business_name,
          contact_person_name: contactPersonName,
          contact_person_number: contactPhone,
          address: store.business_address,
          city_id: store.carrybee_city_id!,
          zone_id: store.carrybee_zone_id!,
          area_id: store.carrybee_area_id!,
        });

        // Get Carrybee store ID after creation
        const updatedStores = await this.carrybeeApiService.getStores();
        carrybeeStore = updatedStores.find(
          (s: any) =>
            s.name === store.business_name || s.name === truncatedName,
        );
      } else {
        this.logger.log(
          `Store "${store.business_name}" already exists in Carrybee, reusing ID: ${carrybeeStore.id}`,
        );
      }

      if (carrybeeStore) {
        store.carrybee_store_id = carrybeeStore.id;
        store.is_carrybee_synced = true;
        store.carrybee_synced_at = new Date();
        await this.storesRepository.save(store);
        this.logger.log(
          `Store ${store.id} synced to Carrybee with ID: ${carrybeeStore.id}`,
        );
      } else {
        this.logger.warn(
          `Store created in Carrybee but could not retrieve store ID for "${store.business_name}"`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to create store in Carrybee: ${JSON.stringify(error.response?.data) || error.message}`,
      );
      // Don't fail store creation if Carrybee sync fails
      // Store can be synced later during parcel assignment
    }

    console.log(
      `[STORE CREATED] Merchant ${merchant.id} created store: ${store.business_name} (${store.id})`,
    );

    return store;
  }

  async findAllByMerchant(userId: string): Promise<any[]> {
    const merchant = await this.merchantRepository.findOne({
      where: { user_id: userId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant profile not found');
    }

    const stores = await this.storesRepository.find({
      where: { merchant_id: merchant.id },
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
        `SUM(CASE WHEN parcel.status = :delivered THEN 1 ELSE 0 END)`,
        'delivered_count',
      )
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...returns) THEN 1 ELSE 0 END)`,
        'return_count',
      )
      .where('parcel.merchant_id = :merchantId', { merchantId: merchant.id })
      .groupBy('parcel.store_id')
      .setParameters({
        delivered: ParcelStatus.DELIVERED,
        returns: [
          ParcelStatus.RETURNED,
          ParcelStatus.RETURNED_TO_HUB,
          ParcelStatus.RETURN_TO_MERCHANT,
          ParcelStatus.PAID_RETURN,
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
    });

    if (!defaultStore) {
      return null;
    }

    const stats = await this.storesRepository.manager
      .createQueryBuilder(Parcel, 'parcel')
      .select('COUNT(parcel.id)', 'total_handled')
      .addSelect(
        `SUM(CASE WHEN parcel.status = :delivered THEN 1 ELSE 0 END)`,
        'delivered_count',
      )
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...returns) THEN 1 ELSE 0 END)`,
        'return_count',
      )
      // FIXED: Use 'defaultStore.id' instead of undefined 'id'
      .where('parcel.store_id = :storeId', { storeId: defaultStore.id })
      .setParameters({
        delivered: ParcelStatus.DELIVERED,
        returns: [
          ParcelStatus.RETURNED,
          ParcelStatus.RETURNED_TO_HUB,
          ParcelStatus.RETURN_TO_MERCHANT,
          ParcelStatus.PAID_RETURN,
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
        `SUM(CASE WHEN parcel.status = :delivered THEN 1 ELSE 0 END)`,
        'delivered_count',
      )
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...returns) THEN 1 ELSE 0 END)`,
        'return_count',
      )
      .where('parcel.store_id = :storeId', { storeId: id })
      .setParameters({
        delivered: ParcelStatus.DELIVERED,
        returns: [
          ParcelStatus.RETURNED,
          ParcelStatus.RETURNED_TO_HUB,
          ParcelStatus.RETURN_TO_MERCHANT,
          ParcelStatus.PAID_RETURN,
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
    if (dto.district !== undefined) store.district = dto.district;
    if (dto.thana !== undefined) store.thana = dto.thana;
    if (dto.area !== undefined) store.area = dto.area;
    if (dto.phone_number !== undefined) store.phone_number = dto.phone_number;
    if (dto.email !== undefined) store.email = dto.email;
    if (dto.facebook_page !== undefined)
      store.facebook_page = dto.facebook_page;
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

    // 2. Update status
    store.status = StoreStatus.DECLINED;
    await this.storesRepository.save(store);

    console.log(`[STORE DECLINED] Store ${id} status set to DECLINED`);
    return store;
  }

  async findAllStores(): Promise<any[]> {
    // 1. Fetch all stores with relations
    const stores = await this.storesRepository.find({
      relations: ['merchant', 'merchant.user', 'hub'],
      order: { created_at: 'DESC' },
    });

    // 2. Fetch aggregated stats for ALL stores in one query
    const stats = await this.storesRepository.manager
      .createQueryBuilder(Parcel, 'parcel')
      .select('parcel.store_id', 'store_id')
      .addSelect('COUNT(parcel.id)', 'total_handled')
      .addSelect(
        `SUM(CASE WHEN parcel.status = :delivered THEN 1 ELSE 0 END)`,
        'delivered_count',
      )
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...returns) THEN 1 ELSE 0 END)`,
        'return_count',
      )
      .groupBy('parcel.store_id')
      .setParameters({
        delivered: ParcelStatus.DELIVERED,
        returns: [
          ParcelStatus.RETURNED,
          ParcelStatus.RETURNED_TO_HUB,
          ParcelStatus.RETURN_TO_MERCHANT,
          ParcelStatus.PAID_RETURN,
        ],
      })
      .getRawMany();

    // 3. Merge stats into stores
    return stores.map((store) => {
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
  }

  async assignHubToStore(storeId: string, hubId: string): Promise<Store> {
    const store = await this.storesRepository.findOne({
      where: { id: storeId },
      relations: ['merchant', 'hub'],
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
