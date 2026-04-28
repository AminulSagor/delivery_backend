import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '../stores/entities/store.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Parcel, ParcelStatus } from '../parcels/entities/parcel.entity';
import { ThirdPartyProvider } from '../third-party-providers/entities/third-party-provider.entity';
import { CoverageArea } from '../coverage-areas/entities/coverage-area.entity';
import { CarrybeeApiService } from './carrybee-api.service';
import { SyncStoreToCarrybeeDto } from './dto/sync-store-to-carrybee.dto';
import {
  AssignParcelToCarrybeeDto,
  AssignToCarrybeeDto,
} from './dto/assign-to-carrybee.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { DeliveryProvider } from '../common/enums/delivery-provider.enum';
import {
  PaginatedResponse,
  PaginationMeta,
} from 'src/common/dto/pagination.dto';
import { CarrybeeParcelQueryDto } from './dto/carrybee-parcel-query.dto';

@Injectable()
export class CarrybeeService {
  private readonly logger = new Logger(CarrybeeService.name);

  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    @InjectRepository(Parcel)
    private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(ThirdPartyProvider)
    private readonly providerRepository: Repository<ThirdPartyProvider>,
    @InjectRepository(CoverageArea)
    private readonly coverageAreaRepository: Repository<CoverageArea>,
    private readonly carrybeeApiService: CarrybeeApiService,
  ) {}

  // ===== LOCATION METHODS =====

  async getCities() {
    return await this.carrybeeApiService.getCities();
  }

  async getZones(cityId: number) {
    return await this.carrybeeApiService.getZones(cityId);
  }

  async getAreas(cityId: number, zoneId: number) {
    return await this.carrybeeApiService.getAreas(cityId, zoneId);
  }

  async searchArea(query: string) {
    if (!query || query.length < 3) {
      throw new BadRequestException(
        'Search query must be at least 3 characters',
      );
    }
    return await this.carrybeeApiService.searchArea(query);
  }

  // ===== DEBUG METHODS =====

  async getCarrybeeStores() {
    return await this.carrybeeApiService.getStores();
  }

  // ===== STORE SYNC METHOD =====

  async syncStoreToCarrybee(
    storeId: string,
    dto: SyncStoreToCarrybeeDto,
    userId: string,
    userRole: UserRole,
  ) {
    // Find store
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
      relations: ['merchant', 'merchant.user'],
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    // Check ownership (if merchant)
    if (userRole === UserRole.MERCHANT) {
      const merchant = await this.merchantRepository.findOne({
        where: { user_id: userId },
      });

      if (!merchant || store.merchant_id !== merchant.id) {
        throw new BadRequestException('You can only sync your own stores');
      }
    }

    // Validate store has required address fields
    if (!store.district || !store.thana) {
      throw new BadRequestException(
        'Store must have district and thana before syncing to Carrybee',
      );
    }

    // Check if already synced
    if (store.is_carrybee_synced && store.carrybee_store_id) {
      throw new BadRequestException(
        'Store is already synced to Carrybee. Contact support to re-sync.',
      );
    }

    // Use provided DTO carrybee ids if present, otherwise fall back to stored values
    const cityId = (dto && (dto.carrybee_city_id as any)) || store.carrybee_city_id;
    const zoneId = (dto && (dto.carrybee_zone_id as any)) || store.carrybee_zone_id;
    const areaId = (dto && (dto.carrybee_area_id as any)) || store.carrybee_area_id;

    if (!cityId || !zoneId || !areaId) {
      throw new BadRequestException(
        'Carrybee location IDs (city_id, zone_id, area_id) are required to sync this store. Provide them in the request body or set them on the store first.',
      );
    }

    // Get merchant name for contact person
    const contactPersonName = store.merchant?.user?.full_name || 'Store Owner';

    // Format phone number
    const contactPhone = this.carrybeeApiService.formatPhoneForCarrybee(
      store.phone_number,
    );

    // Create store in Carrybee
    try {
      const carrybeeResponse = await this.carrybeeApiService.createStore({
        name: store.business_name,
        contact_person_name: contactPersonName,
        contact_person_number: contactPhone,
        address: store.business_address,
        city_id: cityId,
        zone_id: zoneId,
        area_id: areaId,
      });

      // Update store with Carrybee mapping used for sync
      store.carrybee_city_id = cityId;
      store.carrybee_zone_id = zoneId;
      store.carrybee_area_id = areaId;
      store.is_carrybee_synced = true;
      store.carrybee_synced_at = new Date();

      // Note: Carrybee doesn't return store_id in response, so we use the store name as identifier
      // In production, you might need to call GET /stores to find the created store
      const stores = await this.carrybeeApiService.getStores();
      const carrybeeStore = stores.find(
        (s: any) => s.name === store.business_name,
      );

      if (carrybeeStore) {
        store.carrybee_store_id = carrybeeStore.id;
      }

      await this.storeRepository.save(store);

      this.logger.log(
        `Store ${store.id} synced to Carrybee successfully (Carrybee Store ID: ${store.carrybee_store_id})`,
      );

      return {
        store_id: store.id,
        carrybee_store_id: store.carrybee_store_id,
        is_carrybee_synced: store.is_carrybee_synced,
      };
    } catch (error) {
      this.logger.error(
        `Failed to sync store ${storeId} to Carrybee`,
        error.response?.data || error.message,
      );
      throw new BadRequestException(
        `Failed to sync store to Carrybee: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  // ===== NEW: INTERNAL SYNC HELPER =====
  /**
   * Auto-syncs a store using existing DB data.
   * Used during Parcel Assignment if the store isn't synced yet.
   */
  private async internalSyncStore(store: Store): Promise<void> {
    this.logger.log(`Auto-syncing store ${store.id} to Carrybee...`);

    // 1. Validate Store Data
    if (!store.district || !store.thana || !store.area) {
      throw new BadRequestException(
        'Store missing location data (district/thana/area)',
      );
    }
    if (
      !store.carrybee_city_id ||
      !store.carrybee_zone_id ||
      !store.carrybee_area_id
    ) {
      throw new BadRequestException('Store missing Carrybee location mapping');
    }

    // 2. Prepare Data
    const contactPersonName = store.merchant?.user?.full_name || 'Store Owner';
    const contactPhone = this.carrybeeApiService.formatPhoneForCarrybee(
      store.phone_number,
    );

    try {
      // 3. Check / Create
      const existingStores = await this.carrybeeApiService.getStores();
      const truncatedName = store.business_name.substring(0, 30).trim();

      let carrybeeStore = existingStores.find(
        (s: any) => s.name === store.business_name || s.name === truncatedName,
      );

      if (!carrybeeStore) {
        await this.carrybeeApiService.createStore({
          name: store.business_name,
          contact_person_name: contactPersonName,
          contact_person_number: contactPhone,
          address: store.business_address,
          city_id: store.carrybee_city_id,
          zone_id: store.carrybee_zone_id,
          area_id: store.carrybee_area_id,
        });

        // Fetch again to get ID
        const updatedStores = await this.carrybeeApiService.getStores();
        carrybeeStore = updatedStores.find(
          (s: any) =>
            s.name === store.business_name || s.name === truncatedName,
        );
      }

      if (carrybeeStore) {
        store.carrybee_store_id = carrybeeStore.id;
        store.is_carrybee_synced = true;
        store.carrybee_synced_at = new Date();
        await this.storeRepository.save(store);
        this.logger.log(`Store auto-synced. ID: ${store.carrybee_store_id}`);
      } else {
        throw new Error('Could not retrieve Carrybee Store ID after creation');
      }
    } catch (error) {
      throw new BadRequestException(`Auto-sync failed: ${error.message}`);
    }
  }

  /**
   * Public helper to sync a store by ID. Useful for workers and admin actions.
   */
  async syncStoreById(storeId: string) {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
      relations: ['merchant', 'merchant.user'],
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    await this.internalSyncStore(store);
    return {
      store_id: store.id,
      carrybee_store_id: store.carrybee_store_id,
      is_carrybee_synced: store.is_carrybee_synced,
    };
  }

  // ===== PARCEL ASSIGNMENT METHODS =====

  async getParcelsForThirdPartyAssignment(
    hubId: string,
    query: CarrybeeParcelQueryDto,
  ): Promise<PaginatedResponse<Parcel>> {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'created_at',
      order = 'DESC',
      merchantId,
      storeId,
      customerName,
      customerPhone,
      merchantName,
      area,
      minAmount,
      maxAmount,
      deliveryType,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('parcel.delivery_coverage_area', 'coverageArea')
      .leftJoinAndSelect('parcel.merchant', 'merchant')
      .leftJoinAndSelect('merchant.user', 'merchantUser')
      .where('parcel.current_hub_id = :hubId', { hubId })
      .andWhere('parcel.status = :status', { status: ParcelStatus.IN_HUB })
      .andWhere('parcel.assigned_rider_id IS NULL');

    if (merchantId) {
      queryBuilder.andWhere('parcel.merchant_id = :merchantId', { merchantId });
    }

    if (storeId) {
      queryBuilder.andWhere('parcel.store_id = :storeId', { storeId });
    }

    if (customerName?.trim()) {
      queryBuilder.andWhere('parcel.customer_name ILIKE :customerName', {
        customerName: `%${customerName.trim()}%`,
      });
    }

    if (customerPhone?.trim()) {
      queryBuilder.andWhere('parcel.customer_phone ILIKE :customerPhone', {
        customerPhone: `%${customerPhone.trim()}%`,
      });
    }

    if (merchantName?.trim()) {
      queryBuilder.andWhere('merchantUser.full_name ILIKE :merchantName', {
        merchantName: `%${merchantName.trim()}%`,
      });
    }

    if (area?.trim()) {
      queryBuilder.andWhere(
        '(coverageArea.area ILIKE :area OR coverageArea.zone ILIKE :area OR coverageArea.city ILIKE :area OR parcel.delivery_area ILIKE :area)',
        { area: `%${area.trim()}%` },
      );
    }

    if (minAmount !== undefined) {
      queryBuilder.andWhere(
        'COALESCE(parcel.cod_amount, parcel.product_price, parcel.total_charge, 0) >= :minAmount',
        { minAmount },
      );
    }

    if (maxAmount !== undefined) {
      queryBuilder.andWhere(
        'COALESCE(parcel.cod_amount, parcel.product_price, parcel.total_charge, 0) <= :maxAmount',
        { maxAmount },
      );
    }

    if (deliveryType !== undefined) {
      queryBuilder.andWhere('parcel.delivery_type = :deliveryType', {
        deliveryType,
      });
    }

    if (search?.trim()) {
      const keyword = `%${search.trim()}%`;
      queryBuilder.andWhere(
        `(
          CAST(parcel.id AS TEXT) ILIKE :keyword OR
          parcel.tracking_number ILIKE :keyword OR
          parcel.parcel_tx_id ILIKE :keyword OR
          parcel.merchant_order_id ILIKE :keyword OR
          parcel.customer_name ILIKE :keyword OR
          parcel.customer_phone ILIKE :keyword OR
          merchantUser.full_name ILIKE :keyword OR
          store.business_name ILIKE :keyword OR
          coverageArea.area ILIKE :keyword OR
          coverageArea.zone ILIKE :keyword OR
          coverageArea.city ILIKE :keyword OR
          parcel.delivery_area ILIKE :keyword
        )`,
        { keyword },
      );
    }

    const sortFieldMap: Record<string, string> = {
      created_at: 'parcel.created_at',
      updated_at: 'parcel.updated_at',
      tracking_number: 'parcel.tracking_number',
      tracking: 'parcel.tracking_number',
      parcel_tx_id: 'parcel.parcel_tx_id',
      customer_name: 'parcel.customer_name',
      customer: 'parcel.customer_name',
      customer_phone: 'parcel.customer_phone',
      merchant_name: 'merchantUser.full_name',
      merchant: 'merchantUser.full_name',
      area: 'COALESCE(coverageArea.area, parcel.delivery_area)',
      cod_amount: 'parcel.cod_amount',
      product_price: 'parcel.product_price',
      total_charge: 'parcel.total_charge',
      charge: 'parcel.total_charge',
      price: 'COALESCE(parcel.cod_amount, parcel.product_price, 0)',
      merchant_price: 'COALESCE(parcel.cod_amount, parcel.product_price, 0)',
      status: 'parcel.status',
    };
    const normalizedSortBy = (sortBy || '').trim().toLowerCase();
    const safeSortBy =
      sortFieldMap[normalizedSortBy] || sortFieldMap['created_at'];
    const safeOrder: 'ASC' | 'DESC' = order === 'ASC' ? 'ASC' : 'DESC';

    queryBuilder.orderBy(safeSortBy, safeOrder).skip(skip).take(limit);

    const [parcels, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    const pagination: PaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    return {
      items: parcels,
      pagination,
    };
  }

  async assignParcelToCarrybee(
    parcelId: string,
    dto: AssignToCarrybeeDto,
    hubId?: string,
    bypassHubCheck: boolean = false,
  ) {
    // 1. Find parcel with all necessary relations
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId },
      relations: [
        'store',
        'store.merchant',
        'store.merchant.user',
        'delivery_coverage_area',
      ],
    });

    if (!parcel) {
      throw new NotFoundException(`Parcel with ID ${parcelId} not found`);
    }

    // 2. Validate parcel belongs to hub (skip check for admin/bypass)
    if (!bypassHubCheck) {
      const belongsToHub =
        parcel.current_hub_id === hubId ||
        (parcel.store && parcel.store.hub_id === hubId);

      if (!belongsToHub) {
        throw new BadRequestException('Parcel does not belong to your hub');
      }
    }

    // 3. Validate parcel status
    if (parcel.status !== ParcelStatus.IN_HUB) {
      throw new BadRequestException(
        `Parcel must be in hub to assign to Carrybee (current status: ${parcel.status})`,
      );
    }

    // 4. Check if already assigned
    if (parcel.assigned_rider_id) {
      throw new BadRequestException('Parcel is already assigned to a rider');
    }

    if (parcel.delivery_provider === DeliveryProvider.CARRYBEE) {
      throw new BadRequestException('Parcel is already assigned to Carrybee');
    }

    // 5. Validate provider (auto-fetch if not provided for auto-assignment)
    let provider: ThirdPartyProvider | null;

    if (dto.provider_id) {
      provider = await this.providerRepository.findOne({
        where: { id: dto.provider_id, is_active: true },
      });

      if (!provider || provider.provider_code !== 'CARRYBEE') {
        throw new BadRequestException('Invalid or inactive provider');
      }
    } else {
      // Auto-fetch Carrybee provider (for auto-assignment scenarios)
      provider = await this.providerRepository.findOne({
        where: { provider_code: 'CARRYBEE', is_active: true },
      });

      if (!provider) {
        throw new BadRequestException(
          'Carrybee provider not found or inactive',
        );
      }
    }

    // 6. Check store and auto-sync if needed
    const store = parcel.store;
    if (!store) {
      throw new BadRequestException('Parcel has no associated store');
    }

    // Auto-sync store to Carrybee if not already synced
    if (!store.is_carrybee_synced || !store.carrybee_store_id) {
      this.logger.log(
        `Auto-syncing store ${store.id} to Carrybee before parcel assignment`,
      );

      // Validate store has required location fields
      if (!store.district || !store.thana || !store.area) {
        throw new BadRequestException(
          'Store must have district, thana, and area before syncing to Carrybee',
        );
      }

      // Validate store has Carrybee location IDs
      if (
        !store.carrybee_city_id ||
        !store.carrybee_zone_id ||
        !store.carrybee_area_id
      ) {
        throw new BadRequestException(
          'Store must have Carrybee location IDs (city_id, zone_id, area_id). Please update store with Carrybee location first.',
        );
      }

      // Get merchant name for contact person
      const contactPersonName =
        store.merchant?.user?.full_name || 'Store Owner';

      // Format phone number
      const contactPhone = this.carrybeeApiService.formatPhoneForCarrybee(
        store.phone_number,
      );

      // Create store in Carrybee or fetch if already exists
      try {
        // First, check if store already exists in Carrybee
        const existingStores = await this.carrybeeApiService.getStores();

        // Carrybee truncates name to 30 chars, so check with truncated name
        const truncatedName = store.business_name.substring(0, 30).trim();
        let carrybeeStore = existingStores.find(
          (s: any) =>
            s.name === store.business_name || s.name === truncatedName,
        );

        if (!carrybeeStore) {
          // Store doesn't exist, create it
          this.logger.log(`Creating new store in Carrybee: ${truncatedName}`);

          await this.carrybeeApiService.createStore({
            name: store.business_name,
            contact_person_name: contactPersonName,
            contact_person_number: contactPhone,
            address: store.business_address,
            city_id: store.carrybee_city_id,
            zone_id: store.carrybee_zone_id,
            area_id: store.carrybee_area_id,
          });

          // Fetch the newly created store
          const updatedStores = await this.carrybeeApiService.getStores();
          carrybeeStore = updatedStores.find(
            (s: any) =>
              s.name === store.business_name || s.name === truncatedName,
          );
        } else {
          this.logger.log(
            `Store "${store.business_name}" already exists in Carrybee with ID: ${carrybeeStore.id}`,
          );
        }

        if (carrybeeStore) {
          store.carrybee_store_id = carrybeeStore.id;
          this.logger.log(`Carrybee store ID set: ${carrybeeStore.id}`);
        } else {
          this.logger.warn(
            `Could not retrieve Carrybee store ID for "${store.business_name}"`,
          );
        }

        // Update store sync status
        store.is_carrybee_synced = true;
        store.carrybee_synced_at = new Date();
        await this.storeRepository.save(store);

        this.logger.log(
          `Store ${store.id} synced to Carrybee successfully (ID: ${store.carrybee_store_id})`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to auto-sync store ${store.id} to Carrybee`,
          error.response?.data || error.message,
        );
        throw new BadRequestException(
          `Failed to sync store to Carrybee: ${error.response?.data?.message || error.message}`,
        );
      }
    }

    // 7. Validate store has Carrybee store ID
    if (!store.carrybee_store_id) {
      throw new BadRequestException(
        'Store is not synced with Carrybee. Please create a new store with valid Carrybee location IDs.',
      );
    }

    // 8. Validate weight
    if (!parcel.product_weight || parcel.product_weight <= 0) {
      throw new BadRequestException(
        'Parcel weight is required for Carrybee assignment',
      );
    }

    // 9. Convert weight to grams
    let itemWeight: number;
    try {
      itemWeight = this.carrybeeApiService.convertWeightToGrams(
        parcel.product_weight,
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }

    // 10. Validate COD amount
    if (parcel.cod_amount > 100000) {
      throw new BadRequestException(
        `COD amount exceeds Carrybee limit (max 100,000 Taka, got ${parcel.cod_amount})`,
      );
    }

    // 11. Format phone numbers
    const recipientPhone = this.carrybeeApiService.formatPhoneForCarrybee(
      parcel.customer_phone,
    );

    // 12. Map delivery type
    const deliveryType = this.carrybeeApiService.mapDeliveryType(
      parcel.delivery_type,
    );

    // 13. Get recipient Carrybee location from coverage area (preferred) or parcel fields
    const coverageArea = parcel.delivery_coverage_area;
    const recipientCityId =
      coverageArea?.city_id || parcel.recipient_carrybee_city_id;
    const recipientZoneId =
      coverageArea?.zone_id || parcel.recipient_carrybee_zone_id;
    const recipientAreaId =
      coverageArea?.area_id || parcel.recipient_carrybee_area_id;

    if (!recipientCityId || !recipientZoneId) {
      throw new BadRequestException(
        'Parcel must have a valid delivery coverage area with Carrybee location IDs (city_id, zone_id).',
      );
    }

    // 14. Validate recipient address length (Carrybee requires 10-200 chars)
    const recipientAddress = parcel.customer_address?.trim() || '';
    if (recipientAddress.length < 10) {
      throw new BadRequestException(
        `Delivery address is too short (minimum 10 characters, got ${recipientAddress.length}). Please update the parcel with a more detailed address.`,
      );
    }
    if (recipientAddress.length > 200) {
      throw new BadRequestException(
        `Delivery address is too long (maximum 200 characters, got ${recipientAddress.length}). Please shorten the address.`,
      );
    }

    // 15. Validate recipient name length (Carrybee requires 2-99 chars)
    const recipientName = parcel.customer_name?.trim() || '';
    if (recipientName.length < 2 || recipientName.length > 99) {
      throw new BadRequestException(
        `Customer name must be between 2 and 99 characters (got ${recipientName.length}).`,
      );
    }

    // 16. Build order data for Carrybee
    const orderData = {
      store_id: store.carrybee_store_id,
      merchant_order_id:
        parcel.merchant_order_id?.substring(0, 25) || undefined,
      delivery_type: deliveryType,
      product_type: parcel.parcel_type || 1,
      recipient_phone: recipientPhone,
      recipient_name: recipientName,
      recipient_address: recipientAddress,
      city_id: recipientCityId,
      zone_id: recipientZoneId,
      area_id: recipientAreaId || undefined,
      special_instruction:
        parcel.special_instructions?.substring(0, 256) || undefined,
      product_description:
        parcel.product_description?.substring(0, 256) || undefined,
      item_weight: itemWeight,
      collectable_amount: parcel.is_cod ? Math.round(parcel.cod_amount) : 0,
    };

    this.logger.log(
      `Creating Carrybee order with data: ${JSON.stringify(orderData)}`,
    );

    // 17. Create order in Carrybee
    try {
      const carrybeeOrder =
        await this.carrybeeApiService.createOrder(orderData);

      // 18. Update parcel
      parcel.delivery_provider = DeliveryProvider.CARRYBEE;
      parcel.third_party_provider_id = provider.id;
      parcel.status = ParcelStatus.ASSIGNED_TO_THIRD_PARTY;
      parcel.carrybee_consignment_id = carrybeeOrder.consignment_id;
      parcel.carrybee_delivery_fee = parseFloat(carrybeeOrder.delivery_fee);
      parcel.carrybee_cod_fee = carrybeeOrder.cod_fee;
      parcel.assigned_to_carrybee_at = new Date();

      if (dto.notes) {
        parcel.admin_notes = dto.notes;
      }

      await this.parcelRepository.save(parcel);

      this.logger.log(
        `Parcel ${parcel.id} assigned to Carrybee (Consignment: ${carrybeeOrder.consignment_id})`,
      );

      return {
        parcel_id: parcel.id,
        carrybee_consignment_id: carrybeeOrder.consignment_id,
        delivery_fee: carrybeeOrder.delivery_fee,
        cod_fee: carrybeeOrder.cod_fee,
      };
    } catch (error) {
      this.logger.error(
        `Failed to assign parcel ${parcelId} to Carrybee`,
        error.response?.data || error.message,
      );
      throw new BadRequestException(
        `Failed to assign parcel to Carrybee: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  // ===== BULK ASSIGNMENT =====
  async assignParcelsToCarrybee(
    dto: AssignParcelToCarrybeeDto,
    hubId?: string,
    bypassHubCheck: boolean = false,
  ): Promise<{ success: any[]; failed: any[] }> {
    const { parcel_ids, provider_id, notes } = dto;

    // FIX 1: Explicitly type the arrays
    const success: any[] = [];
    const failed: { parcel_id: string; reason: string }[] = [];

    // 1. Validate Provider
    const provider = await this.providerRepository.findOne({
      where: { id: provider_id, is_active: true },
    });

    if (!provider || provider.provider_code !== 'CARRYBEE') {
      throw new BadRequestException('Invalid or inactive provider selected');
    }

    // 2. Process Loop
    for (const parcelId of parcel_ids) {
      try {
        const result = await this.assignSingleParcel(
          parcelId,
          provider,
          hubId,
          notes,
          bypassHubCheck,
        );
        success.push(result);
      } catch (error) {
        failed.push({
          parcel_id: parcelId,
          reason: error.message,
        });
      }
    }

    return { success, failed };
  }

  // ===== SINGLE ASSIGNMENT HELPER =====
  private async assignSingleParcel(
    parcelId: string,
    provider: ThirdPartyProvider,
    hubId?: string,
    notes?: string,
    bypassHubCheck: boolean = false,
  ) {
    // 1. Find parcel
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId },
      relations: [
        'store',
        'store.merchant',
        'store.merchant.user',
        'delivery_coverage_area',
      ],
    });

    if (!parcel) throw new NotFoundException(`Parcel not found`);

    // 2. Validate Hub (skip for admin/bypass)
    if (!bypassHubCheck) {
      const belongsToHub =
        parcel.current_hub_id === hubId ||
        (parcel.store && parcel.store.hub_id === hubId);
      if (!belongsToHub)
        throw new BadRequestException('Parcel does not belong to your hub');
    }

    // 3. Validate Status
    if (parcel.status !== ParcelStatus.IN_HUB) {
      throw new BadRequestException(
        `Invalid status: ${parcel.status}. Must be IN_HUB.`,
      );
    }

    // 4. Validate Conflicts
    if (parcel.assigned_rider_id)
      throw new BadRequestException('Already assigned to a rider');
    if (parcel.delivery_provider === DeliveryProvider.CARRYBEE)
      throw new BadRequestException('Already assigned to Carrybee');

    // 5. Check Store & Sync
    const store = parcel.store;
    if (!store) throw new BadRequestException('Parcel has no associated store');

    if (!store.is_carrybee_synced || !store.carrybee_store_id) {
      // FIX 2: Call the new internal method, NOT the public controller method
      await this.internalSyncStore(store);
    }

    // Re-check
    if (!store.carrybee_store_id)
      throw new BadRequestException('Store failed to sync with Carrybee');

    // 6. Validate Data
    if (!parcel.product_weight || parcel.product_weight <= 0)
      throw new BadRequestException('Weight is required');
    if (parcel.cod_amount > 100000)
      throw new BadRequestException('COD exceeds limit');

    // 7. Prepare Carrybee Data
    const itemWeight = this.carrybeeApiService.convertWeightToGrams(
      parcel.product_weight,
    );
    const recipientPhone = this.carrybeeApiService.formatPhoneForCarrybee(
      parcel.customer_phone,
    );
    const deliveryType = this.carrybeeApiService.mapDeliveryType(
      parcel.delivery_type,
    );

    const coverageArea = parcel.delivery_coverage_area;
    const cityId = coverageArea?.city_id || parcel.recipient_carrybee_city_id;
    const zoneId = coverageArea?.zone_id || parcel.recipient_carrybee_zone_id;
    const areaId = coverageArea?.area_id || parcel.recipient_carrybee_area_id;

    if (!cityId || !zoneId)
      throw new BadRequestException('Missing Carrybee location IDs');

    // Text Validations
    const address = parcel.customer_address?.trim() || '';
    if (address.length < 10) throw new BadRequestException('Address too short');
    if (address.length > 200) throw new BadRequestException('Address too long');

    const name = parcel.customer_name?.trim() || '';
    if (name.length < 2 || name.length > 99)
      throw new BadRequestException('Name invalid length');

    // 8. Create Order Payload
    const orderData = {
      store_id: store.carrybee_store_id,
      merchant_order_id: parcel.merchant_order_id?.substring(0, 25),
      delivery_type: deliveryType,
      product_type: parcel.parcel_type || 1,
      recipient_phone: recipientPhone,
      recipient_name: name,
      recipient_address: address,
      city_id: cityId,
      zone_id: zoneId,
      area_id: areaId || undefined,
      special_instruction: parcel.special_instructions?.substring(0, 256),
      product_description: parcel.product_description?.substring(0, 256),
      item_weight: itemWeight,
      collectable_amount: parcel.is_cod ? Math.round(parcel.cod_amount) : 0,
    };

    // 9. Call API
    const carrybeeOrder = await this.carrybeeApiService.createOrder(orderData);

    // 10. Update Local
    parcel.delivery_provider = DeliveryProvider.CARRYBEE;
    parcel.third_party_provider_id = provider.id;
    parcel.status = ParcelStatus.ASSIGNED_TO_THIRD_PARTY;
    parcel.carrybee_consignment_id = carrybeeOrder.consignment_id;
    parcel.carrybee_delivery_fee = parseFloat(carrybeeOrder.delivery_fee);
    parcel.carrybee_cod_fee = carrybeeOrder.cod_fee;
    parcel.assigned_to_carrybee_at = new Date();
    if (notes) parcel.admin_notes = notes;

    await this.parcelRepository.save(parcel);

    return {
      parcel_id: parcel.id,
      tracking_number: parcel.tracking_number,
      consignment_id: carrybeeOrder.consignment_id,
      delivery_fee: carrybeeOrder.delivery_fee,
    };
  }
}
