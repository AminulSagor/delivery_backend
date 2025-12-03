import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere, In } from 'typeorm';
import {
  PaginatedResponse,
  PaginationMeta,
} from '../common/dto/pagination.dto';
import { Parcel, ParcelStatus, PaymentStatus } from './entities/parcel.entity';
import { CreateParcelDto } from './dto/create-parcel.dto';
import { UpdateParcelDto } from './dto/update-parcel.dto';
import { CoverageArea } from '../coverage-areas/entities/coverage-area.entity';
import { Store } from '../stores/entities/store.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Hub } from '../hubs/entities/hub.entity';
import { PricingService } from '../pricing/pricing.service';
import { PricingZone } from '../common/enums/pricing-zone.enum';
import { CustomerService } from '../customer/customer.service';
import { CalculatePricingDto } from './dto/calculate-pricing.dto';
import { PickupRequestsService } from '../pickup-requests/pickup-requests.service';
import { Rider } from '../riders/entities/rider.entity';
import { AssignParcelToRiderDto } from '../riders/dto/assign-parcel.dto';
import { TransferParcelDto } from './dto/transfer-parcel.dto';
import { ParcelType } from '../common/enums/parcel-type.enum';
import { DeliveryType } from '../common/enums/delivery-type.enum';

@Injectable()
export class ParcelsService {
  private readonly logger = new Logger(ParcelsService.name);

  constructor(
    @InjectRepository(Parcel)
    private parcelRepository: Repository<Parcel>,
    @InjectRepository(CoverageArea)
    private coverageAreaRepository: Repository<CoverageArea>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(Merchant)
    private merchantRepository: Repository<Merchant>,
    @InjectRepository(Rider)
    private riderRepository: Repository<Rider>,
    @InjectRepository(Hub)
    private hubRepository: Repository<Hub>,
    private pricingService: PricingService,
    private customerService: CustomerService,
    private pickupRequestsService: PickupRequestsService,
  ) {}

  private async generateTrackingNumber(): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const count = await this.parcelRepository.count({
      where: { created_at: Between(startOfDay, endOfDay) as any },
    });
    const sequenceNumber = (count + 1).toString().padStart(5, '0');
    return `TRK-${dateStr}-${sequenceNumber}`;
  }

  private determinePricingZone(coverageArea: CoverageArea | null): PricingZone {
    if (!coverageArea) return PricingZone.OUTSIDE_DHAKA;
    if (coverageArea.division === 'Dhaka') {
      return coverageArea.inside_dhaka_flag
        ? PricingZone.INSIDE_DHAKA
        : PricingZone.SUB_DHAKA;
    }
    return PricingZone.OUTSIDE_DHAKA;
  }

  private async calculateCharges(
    merchantId: string,
    deliveryCoverageAreaId: string | null,
    weight: number = 0,
    isCod: boolean,
    codAmount: number,
  ): Promise<{
    delivery_charge: number;
    weight_charge: number;
    cod_charge: number;
    total_charge: number;
  }> {
    let deliveryArea: CoverageArea | null = null;
    if (deliveryCoverageAreaId) {
      deliveryArea = await this.coverageAreaRepository.findOne({
        where: { id: deliveryCoverageAreaId },
      });
      if (!deliveryArea)
        throw new NotFoundException(
          `Delivery coverage area with ID ${deliveryCoverageAreaId} not found`,
        );
    }
    const pricingZone = this.determinePricingZone(deliveryArea);
    const pricingConfig = await this.pricingService.getActivePricing(
      merchantId,
      pricingZone,
    );
    let baseDeliveryCharge = 60,
      weightChargePerKg = 10,
      codPercentage = 1.0;
    if (pricingConfig) {
      baseDeliveryCharge = Number(pricingConfig.delivery_charge);
      weightChargePerKg = Number(pricingConfig.weight_charge_per_kg);
      codPercentage = Number(pricingConfig.cod_percentage);
    } else {
      if (pricingZone === PricingZone.OUTSIDE_DHAKA) baseDeliveryCharge = 120;
      else if (pricingZone === PricingZone.SUB_DHAKA) baseDeliveryCharge = 80;
    }
    const weightCharge = Math.ceil(weight) * weightChargePerKg;
    const codCharge = isCod ? Math.round(codAmount * (codPercentage / 100)) : 0;
    const deliveryCharge = baseDeliveryCharge + weightCharge;
    const totalCharge = deliveryCharge + codCharge;
    return {
      delivery_charge: deliveryCharge,
      weight_charge: weightCharge,
      cod_charge: codCharge,
      total_charge: totalCharge,
    };
  }

  async create(
    createParcelDto: CreateParcelDto,
    userId: string,
    merchantId?: string,
  ): Promise<Parcel> {
    try {
      if (!userId) throw new ForbiddenException('User ID (userId) is required');

      // If merchantId not provided (backward compatibility), fetch it
      if (!merchantId) {
        const merchant = await this.merchantRepository.findOne({
          where: { user_id: userId },
        });
        if (!merchant)
          throw new NotFoundException(
            'Merchant profile not found for this user. Please contact support.',
          );
        merchantId = merchant.id;
      }

      // Validate store and get pickup request
      let store: Store | null = null;
      let pickupRequest: any = null;
      if (createParcelDto.store_id) {
        store = await this.storeRepository.findOne({
          where: { id: createParcelDto.store_id, merchant_id: merchantId },
        });
        if (!store)
          throw new NotFoundException(
            'Store not found or does not belong to this merchant. Please check the store ID.',
          );

        // Phase 2: Auto-link to pickup request
        try {
          pickupRequest =
            await this.pickupRequestsService.findOrCreateActiveForStore(
              merchantId,
              createParcelDto.store_id,
            );
        } catch (error) {
          this.logger.warn(
            `[PICKUP REQUEST] Could not create/find pickup request: ${error.message}`,
          );
          // Continue without pickup request if it fails
        }
      }

      const deliveryArea = createParcelDto.delivery_coverage_area_id
        ? await this.coverageAreaRepository.findOne({
            where: { id: createParcelDto.delivery_coverage_area_id },
          })
        : null;
      if (createParcelDto.delivery_coverage_area_id && !deliveryArea)
        throw new NotFoundException(
          `Delivery coverage area not found. Please select a valid delivery area.`,
        );
      if (
        createParcelDto.is_cod &&
        (!createParcelDto.cod_amount || createParcelDto.cod_amount <= 0)
      )
        throw new BadRequestException(
          'COD amount must be greater than 0 when COD is enabled.',
        );
      if (createParcelDto.product_weight && createParcelDto.product_weight < 0)
        throw new BadRequestException('Product weight cannot be negative.');
      const phoneRegex = /^01[0-9]{9}$/;
      if (!phoneRegex.test(createParcelDto.customer_phone))
        throw new BadRequestException(
          'Invalid customer phone number. Must be in format: 01XXXXXXXXX',
        );
      let customer, isNewCustomer;
      try {
        const result = await this.customerService.findOrCreateFromParcelPayload(
          {
            customer_name: createParcelDto.customer_name,
            customer_phone: createParcelDto.customer_phone,
            delivery_address: createParcelDto.delivery_address,
          },
        );
        customer = result.customer;
        isNewCustomer = result.isNew;
      } catch (error) {
        this.logger.error(`[CUSTOMER ERROR] ${error.message}`, error.stack);
        throw new BadRequestException(
          'Failed to process customer information. Please check the customer details.',
        );
      }
      let charges;
      try {
        charges = await this.calculateCharges(
          merchantId,
          createParcelDto.delivery_coverage_area_id || null,
          createParcelDto.product_weight || 0,
          createParcelDto.is_cod || false,
          createParcelDto.cod_amount || 0,
        );
      } catch (error) {
        this.logger.error(`[PRICING ERROR] ${error.message}`, error.stack);
        throw new BadRequestException(
          'Failed to calculate pricing. Please try again or contact support.',
        );
      }
      let trackingNumber;
      try {
        trackingNumber = await this.generateTrackingNumber();
      } catch (error) {
        this.logger.error(
          `[TRACKING NUMBER ERROR] ${error.message}`,
          error.stack,
        );
        throw new InternalServerErrorException(
          'Failed to generate tracking number. Please try again.',
        );
      }
      // Auto-populate Carrybee IDs from coverage area
      const recipient_carrybee_city_id =
        deliveryArea?.city_id ||
        createParcelDto.recipient_carrybee_city_id ||
        null;
      const recipient_carrybee_zone_id =
        deliveryArea?.zone_id ||
        createParcelDto.recipient_carrybee_zone_id ||
        null;
      const recipient_carrybee_area_id =
        deliveryArea?.area_id ||
        createParcelDto.recipient_carrybee_area_id ||
        null;

      const parcel = this.parcelRepository.create({
        ...createParcelDto,
        merchant_id: merchantId,
        customer_id: customer.id,
        tracking_number: trackingNumber,
        pickup_request_id: pickupRequest?.id || null, // Phase 2: Link to pickup request
        status: ParcelStatus.PENDING,
        payment_status: PaymentStatus.UNPAID,
        delivery_type: createParcelDto.delivery_type || DeliveryType.NORMAL, // Default to Normal (1)
        delivery_charge: charges.delivery_charge,
        weight_charge: charges.weight_charge,
        cod_charge: charges.cod_charge,
        total_charge: charges.total_charge,
        // Auto-populate Carrybee IDs from coverage area
        recipient_carrybee_city_id,
        recipient_carrybee_zone_id,
        recipient_carrybee_area_id,
      });
      let savedParcel;
      try {
        savedParcel = await this.parcelRepository.save(parcel);

        // Phase 2: Update pickup request actual parcels count
        if (pickupRequest) {
          try {
            await this.pickupRequestsService.updateActualParcelsCount(
              pickupRequest.id,
            );
          } catch (error) {
            this.logger.warn(
              `[PICKUP REQUEST] Could not update parcel count: ${error.message}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(`[PARCEL SAVE ERROR] ${error.message}`, error.stack);
        if (error.code === '23505')
          throw new BadRequestException(
            'Duplicate tracking number detected. Please try again.',
          );
        else if (error.code === '23503')
          throw new BadRequestException(
            'Invalid reference data. Please check store ID and delivery area.',
          );
        throw new InternalServerErrorException(
          'Failed to create parcel. Please try again or contact support.',
        );
      }
      this.logger.log(
        `[PARCEL CREATED] Tracking: ${trackingNumber}, Merchant: ${merchantId}, Charge: ${charges.total_charge} BDT`,
      );
      return savedParcel;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.logger.error(`[PARCEL CREATE ERROR] ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'An unexpected error occurred while creating the parcel. Please try again.',
      );
    }
  }

  async findAllForMerchant(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: ParcelStatus,
    storeId?: string,
    sortBy: string = 'created_at',
    order: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedResponse<Parcel>> {
    try {
      if (!userId) throw new ForbiddenException('User ID (userId) is required');

      const where: FindOptionsWhere<Parcel> = { merchant_id: userId };

      if (status) {
        where.status = status;
      }

      if (storeId) {
        where.store_id = storeId;
      }

      const [items, total] = await this.parcelRepository.findAndCount({
        where,
        relations: ['delivery_coverage_area', 'store', 'customer'],
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

      this.logger.log(
        `Retrieved ${items.length} parcels for merchant ${userId}`,
      );

      return { items, pagination };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`[FIND PARCELS ERROR] ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'Failed to retrieve parcels. Please try again.',
      );
    }
  }

  async findOne(
    id: string,
    userId: string | null,
    isAdmin: boolean = false,
  ): Promise<Parcel> {
    try {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id))
        throw new BadRequestException('Invalid parcel ID format');
      const parcel = await this.parcelRepository.findOne({
        where: { id },
        relations: ['merchant', 'store', 'delivery_coverage_area', 'customer'],
      });
      if (!parcel) throw new NotFoundException(`Parcel not found`);
      if (!isAdmin && userId && parcel.merchant_id !== userId)
        throw new ForbiddenException(
          'You do not have permission to view this parcel',
        );
      return parcel;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(
        `[FIND ONE PARCEL ERROR] ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve parcel details. Please try again.',
      );
    }
  }

  async calculatePricing(
    userId: string,
    calculateDto: CalculatePricingDto,
    merchantId?: string,
  ): Promise<{
    zone: string;
    delivery_charge: number;
    weight_charge_per_kg: number;
    cod_percentage: number;
    discount_percentage: number | null;
    start_date: Date | null;
    end_date: Date | null;
  }> {
    try {
      if (!userId) throw new ForbiddenException('User ID (userId) is required');
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(calculateDto.store_id))
        throw new BadRequestException('Invalid store ID format');
      if (!uuidRegex.test(calculateDto.delivery_coverage_area_id))
        throw new BadRequestException(
          'Invalid delivery coverage area ID format',
        );

      // If merchantId not provided (backward compatibility), fetch it
      if (!merchantId) {
        const merchant = await this.merchantRepository.findOne({
          where: { user_id: userId },
        });
        if (!merchant)
          throw new NotFoundException(
            'Merchant profile not found for this user. Please contact support.',
          );
        merchantId = merchant.id;
      }

      // Validate store belongs to merchant
      const store = await this.storeRepository.findOne({
        where: { id: calculateDto.store_id, merchant_id: merchantId },
      });
      if (!store)
        throw new NotFoundException(
          'Store not found or does not belong to this merchant.',
        );

      const deliveryArea = await this.coverageAreaRepository.findOne({
        where: { id: calculateDto.delivery_coverage_area_id },
      });
      if (!deliveryArea)
        throw new NotFoundException(
          `Delivery coverage area not found. Please select a valid delivery area.`,
        );
      const pricingZone = this.determinePricingZone(deliveryArea);
      const pricingConfig = await this.pricingService.getActivePricing(
        calculateDto.store_id,
        pricingZone,
      );
      let baseDeliveryCharge = 60,
        weightChargePerKg = 10,
        codPercentage = 1.0,
        discountPercentage: number | null = null,
        startDate: Date | null = null,
        endDate: Date | null = null;
      if (pricingConfig) {
        baseDeliveryCharge = Number(pricingConfig.delivery_charge);
        weightChargePerKg = Number(pricingConfig.weight_charge_per_kg);
        codPercentage = Number(pricingConfig.cod_percentage);
        discountPercentage = pricingConfig.discount_percentage
          ? Number(pricingConfig.discount_percentage)
          : null;
        startDate = pricingConfig.start_date;
        endDate = pricingConfig.end_date;
      } else {
        if (pricingZone === PricingZone.OUTSIDE_DHAKA) {
          baseDeliveryCharge = 120;
          weightChargePerKg = 25;
          codPercentage = 2.5;
        } else if (pricingZone === PricingZone.SUB_DHAKA) {
          baseDeliveryCharge = 80;
          weightChargePerKg = 20;
          codPercentage = 2.0;
        }
      }
      return {
        zone: pricingZone,
        delivery_charge: baseDeliveryCharge,
        weight_charge_per_kg: weightChargePerKg,
        cod_percentage: codPercentage,
        discount_percentage: discountPercentage,
        start_date: startDate,
        end_date: endDate,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(
        `[CALCULATE PRICING ERROR] ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to calculate pricing. Please try again.',
      );
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 20,
    status?: ParcelStatus,
    merchantId?: string,
    sortBy: string = 'created_at',
    order: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedResponse<Parcel>> {
    try {
      const where: FindOptionsWhere<Parcel> = {};

      if (status) {
        where.status = status;
      }

      if (merchantId) {
        where.merchant_id = merchantId;
      }

      const [items, total] = await this.parcelRepository.findAndCount({
        where,
        relations: ['merchant', 'store', 'delivery_coverage_area', 'customer'],
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

      this.logger.log(`Retrieved ${items.length} parcels (Admin view)`);

      return { items, pagination };
    } catch (error) {
      this.logger.error(
        `[FIND ALL PARCELS ERROR] ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve parcels. Please try again.',
      );
    }
  }

  /**
   * Get all parcels received by a hub (for hub managers)
   * Returns minimal data optimized for hub manager dashboard
   */
  async findAllForHub(
    hubId: string,
    page: number = 1,
    limit: number = 20,
    status?: ParcelStatus,
    sortBy: string = 'created_at',
    order: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedResponse<any>> {
    try {
      // Get all stores assigned to this hub
      const stores = await this.storeRepository.find({
        where: { hub_id: hubId },
        select: ['id'],
      });

      const storeIds = stores.map((store) => store.id);

      if (storeIds.length === 0) {
        // No stores assigned to this hub
        return {
          items: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }

      // Build where clause
      const where: any = {
        store_id: In(storeIds),
      };

      if (status) {
        where.status = status;
      } else {
        // By default, only show parcels that need to be received (PENDING or PICKED_UP)
        // IN_HUB parcels should appear in the for-assignment endpoint
        where.status = In([ParcelStatus.PENDING, ParcelStatus.PICKED_UP]);
      }

      const [parcels, total] = await this.parcelRepository.findAndCount({
        where,
        relations: ['store', 'delivery_coverage_area', 'customer'],
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
      const items = parcels.map((parcel) => ({
        id: parcel.id,
        tracking_number: parcel.tracking_number,
        merchant_order_id: parcel.merchant_order_id,
        store_name: parcel.store?.business_name || 'N/A',
        customer_name: parcel.customer_name,
        customer_phone: parcel.customer_phone,
        delivery_address: parcel.delivery_address,
        zone: parcel.delivery_coverage_area?.area || 'N/A',
        delivery_charge: parcel.delivery_charge,
        weight_charge: parcel.weight_charge,
        cod_charge: parcel.cod_charge,
        total_charge: parcel.total_charge,
        is_cod: parcel.is_cod,
        cod_amount: parcel.cod_amount,
        status: parcel.status,
        special_instructions: parcel.special_instructions,
        created_at: parcel.created_at,
      }));

      this.logger.log(`Retrieved ${items.length} parcels for hub ${hubId}`);

      return { items, pagination };
    } catch (error) {
      this.logger.error(
        `[FIND PARCELS FOR HUB ERROR] ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve parcels for hub. Please try again.',
      );
    }
  }

  /**
   * Mark parcel as received by hub (PENDING/PICKED_UP → IN_HUB)
   */
  async markAsReceived(parcelId: string, hubId: string): Promise<Parcel> {
    try {
      const parcel = await this.parcelRepository.findOne({
        where: { id: parcelId },
        relations: ['store'],
      });

      if (!parcel) {
        throw new NotFoundException('Parcel not found');
      }

      // Verify parcel belongs to a store assigned to this hub
      if (!parcel.store || parcel.store.hub_id !== hubId) {
        throw new ForbiddenException('This parcel does not belong to your hub');
      }

      // Only allow marking as received if status is PENDING or PICKED_UP
      if (
        parcel.status !== ParcelStatus.PENDING &&
        parcel.status !== ParcelStatus.PICKED_UP
      ) {
        throw new BadRequestException(
          `Cannot mark parcel as received. Current status: ${parcel.status}`,
        );
      }

      parcel.status = ParcelStatus.IN_HUB;
      parcel.current_hub_id = hubId;

      // Set origin hub if not already set (first time receiving)
      if (!parcel.origin_hub_id) {
        parcel.origin_hub_id = hubId;
      }

      await this.parcelRepository.save(parcel);

      this.logger.log(
        `[PARCEL RECEIVED] Parcel ${parcel.tracking_number} marked as received by hub ${hubId}`,
      );

      return parcel;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `[MARK PARCEL RECEIVED ERROR] ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to mark parcel as received',
      );
    }
  }

  async update(
    id: string,
    updateParcelDto: UpdateParcelDto,
    userId: string,
    isAdmin: boolean = false,
  ): Promise<Parcel> {
    try {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id))
        throw new BadRequestException('Invalid parcel ID format');
      const parcel = await this.parcelRepository.findOne({ where: { id } });
      if (!parcel)
        throw new NotFoundException(`Parcel with ID ${id} not found`);
      if (!isAdmin && parcel.merchant_id !== userId)
        throw new ForbiddenException(
          'You do not have permission to update this parcel',
        );
      if (updateParcelDto.customer_phone) {
        const phoneRegex = /^01[0-9]{9}$/;
        if (!phoneRegex.test(updateParcelDto.customer_phone))
          throw new BadRequestException(
            'Invalid customer phone number. Must be in format: 01XXXXXXXXX',
          );
      }
      if (
        updateParcelDto.is_cod !== undefined &&
        updateParcelDto.is_cod &&
        (!updateParcelDto.cod_amount || updateParcelDto.cod_amount <= 0)
      )
        throw new BadRequestException(
          'COD amount must be greater than 0 when COD is enabled.',
        );
      if (
        updateParcelDto.product_weight !== undefined &&
        updateParcelDto.product_weight < 0
      )
        throw new BadRequestException('Product weight cannot be negative.');
      if (updateParcelDto.store_id) {
        const merchant = await this.merchantRepository.findOne({
          where: { user_id: userId },
        });
        if (!merchant)
          throw new NotFoundException(
            'Merchant profile not found for this user.',
          );
        const store = await this.storeRepository.findOne({
          where: { id: updateParcelDto.store_id, merchant_id: merchant.id },
        });
        if (!store)
          throw new NotFoundException(
            'Store not found or does not belong to this merchant.',
          );
      }
      if (updateParcelDto.delivery_coverage_area_id) {
        const deliveryArea = await this.coverageAreaRepository.findOne({
          where: { id: updateParcelDto.delivery_coverage_area_id },
        });
        if (!deliveryArea)
          throw new NotFoundException(
            'Delivery coverage area not found. Please select a valid delivery area.',
          );
      }
      Object.assign(parcel, updateParcelDto);
      let updatedParcel;
      try {
        updatedParcel = await this.parcelRepository.save(parcel);
      } catch (error) {
        this.logger.error(
          `[PARCEL UPDATE ERROR] ${error.message}`,
          error.stack,
        );
        if (error.code === '23503')
          throw new BadRequestException(
            'Invalid reference data. Please check store ID and delivery area.',
          );
        throw new InternalServerErrorException(
          'Failed to update parcel. Please try again or contact support.',
        );
      }
      this.logger.log(`[PARCEL UPDATED] ID: ${id}, Merchant: ${userId}`);
      return updatedParcel;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.logger.error(`[UPDATE PARCEL ERROR] ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'An unexpected error occurred while updating the parcel. Please try again.',
      );
    }
  }

  async remove(
    id: string,
    userId: string,
    isAdmin: boolean = false,
  ): Promise<{ message: string }> {
    try {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id))
        throw new BadRequestException('Invalid parcel ID format');
      const parcel = await this.parcelRepository.findOne({ where: { id } });
      if (!parcel)
        throw new NotFoundException(`Parcel with ID ${id} not found`);
      if (!isAdmin && parcel.merchant_id !== userId)
        throw new ForbiddenException(
          'You do not have permission to delete this parcel',
        );
      if (
        parcel.status === ParcelStatus.DELIVERED ||
        parcel.status === ParcelStatus.IN_TRANSIT
      )
        throw new BadRequestException(
          `Cannot delete parcel with status: ${parcel.status}. Please contact support.`,
        );
      try {
        await this.parcelRepository.remove(parcel);
      } catch (error) {
        this.logger.error(
          `[PARCEL DELETE ERROR] ${error.message}`,
          error.stack,
        );
        throw new InternalServerErrorException(
          'Failed to delete parcel. Please try again or contact support.',
        );
      }
      this.logger.log(
        `[PARCEL DELETED] ID: ${id}, Tracking: ${parcel.tracking_number}, Merchant: ${userId}`,
      );
      return {
        message: `Parcel ${parcel.tracking_number} has been successfully deleted`,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.logger.error(`[DELETE PARCEL ERROR] ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'An unexpected error occurred while deleting the parcel. Please try again.',
      );
    }
  }

  /**
   * Get parcels ready for rider assignment (status: IN_HUB)
   */
  async getParcelsForAssignment(
    hubId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    // Get parcels that are IN_HUB status and not assigned to any rider
    // Filter by hub through pickup request relation OR store relation
    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.merchant', 'merchant')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .leftJoinAndSelect('parcel.pickupRequest', 'pickupRequest')
      .where('parcel.status = :status', { status: ParcelStatus.IN_HUB })
      .andWhere('parcel.assigned_rider_id IS NULL')
      .andWhere('(pickupRequest.hub_id = :hubId OR store.hub_id = :hubId)', {
        hubId,
      })
      .orderBy('parcel.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    const [parcels, total] = await queryBuilder.getManyAndCount();

    return { parcels, total };
  }

  /**
   * Assign parcel to rider (Hub Manager only)
   */
  async assignToRider(
    parcelId: string,
    assignDto: AssignParcelToRiderDto,
    hubId: string,
  ) {
    // Find parcel with pickup request to verify hub
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId },
      relations: ['merchant', 'customer', 'pickupRequest'],
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found');
    }

    // Verify parcel is in the hub manager's hub (through pickup request)
    if (!parcel.pickupRequest || parcel.pickupRequest.hub_id !== hubId) {
      throw new ForbiddenException('You can only assign parcels from your hub');
    }

    // Verify parcel status is IN_HUB
    if (parcel.status !== ParcelStatus.IN_HUB) {
      throw new BadRequestException(
        `Parcel must be in IN_HUB status. Current status: ${parcel.status}`,
      );
    }

    // Verify parcel is not already assigned
    if (parcel.assigned_rider_id) {
      throw new ConflictException('Parcel is already assigned to a rider');
    }

    // Find rider
    const rider = await this.riderRepository.findOne({
      where: { id: assignDto.rider_id },
      relations: ['hub', 'user'],
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    // Verify rider is active
    if (!rider.is_active) {
      throw new BadRequestException('Rider is not active');
    }

    // Verify rider belongs to the same hub
    if (rider.hub_id !== hubId) {
      throw new BadRequestException('Rider must belong to your hub');
    }

    // Assign parcel to rider
    parcel.assigned_rider_id = rider.id;
    parcel.assigned_at = new Date();
    parcel.status = ParcelStatus.ASSIGNED_TO_RIDER;

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[PARCEL ASSIGNED] Parcel: ${parcel.tracking_number}, Rider: ${rider.user.full_name}, Hub: ${hubId}`,
    );

    return parcel;
  }

  /**
   * Get rider's assigned parcels (for rider app)
   *
   * Rider App Sections:
   * - DELIVERY: pending (ASSIGNED_TO_RIDER, OUT_FOR_DELIVERY), completed (DELIVERED)
   * - RETURN: pending (FAILED_DELIVERY), completed (RETURNED_TO_HUB)
   *
   * @param riderId - Rider ID
   * @param status - Specific parcel status filter (overrides filter)
   * @param filter - Section filter: delivery_pending, delivery_completed, return_pending, return_completed, all
   */
  async getRiderParcels(
    riderId: string,
    status?: ParcelStatus,
    filter?: string,
  ) {
    const where: any = { assigned_rider_id: riderId };

    // If specific status is provided, use it (takes priority)
    if (status) {
      where.status = status;
    } else if (filter) {
      switch (filter) {
        case 'pickup_pending':
          // Pickup section - Pending (assigned, needs to pick from hub)
          where.status = ParcelStatus.ASSIGNED_TO_RIDER;
          break;
        case 'delivery_pending':
          // Delivery section - Pending (rider has parcel, actively delivering)
          where.status = ParcelStatus.OUT_FOR_DELIVERY;
          break;
        case 'delivery_completed':
          // Delivery section - Completed
          where.status = ParcelStatus.DELIVERED;
          break;
        case 'return_pending':
          // Return section - Pending (failed, needs to return to hub)
          where.status = ParcelStatus.FAILED_DELIVERY;
          break;
        case 'return_completed':
          // Return section - Completed (returned to hub)
          where.status = ParcelStatus.RETURNED_TO_HUB;
          break;
        case 'all':
          // All parcels - no status filter
          break;
        default:
          // Default: show active parcels (pickup + delivery pending)
          where.status = In([
            ParcelStatus.ASSIGNED_TO_RIDER,
            ParcelStatus.OUT_FOR_DELIVERY,
          ]);
      }
    } else {
      // Default: show active parcels (pickup + delivery pending)
      where.status = In([
        ParcelStatus.ASSIGNED_TO_RIDER,
        ParcelStatus.OUT_FOR_DELIVERY,
      ]);
    }

    const parcels = await this.parcelRepository.find({
      where,
      relations: ['merchant', 'customer', 'store'],
      order: { assigned_at: 'DESC' },
    });

    return parcels;
  }

  /**
   * Get rider's deliveries - organized by tab
   * Pending: OUT_FOR_DELIVERY
   * Completed: DELIVERED, PARTIAL_DELIVERY, EXCHANGE, DELIVERY_RESCHEDULED
   */
  async getRiderDeliveries(riderId: string, tab: 'pending' | 'completed') {
    const where: any = { assigned_rider_id: riderId };

    if (tab === 'pending') {
      where.status = ParcelStatus.OUT_FOR_DELIVERY;
    } else {
      // Completed includes all delivery outcomes
      where.status = In([
        ParcelStatus.DELIVERED,
        ParcelStatus.PARTIAL_DELIVERY,
        ParcelStatus.EXCHANGE,
        ParcelStatus.DELIVERY_RESCHEDULED,
      ]);
    }

    return this.parcelRepository.find({
      where,
      relations: ['merchant', 'customer', 'store'],
      order: { updated_at: 'DESC' },
    });
  }

  /**
   * Get rider's returns - organized by tab
   * Pending: RETURNED, PAID_RETURN (verified via OTP, need to return to hub)
   * Completed: RETURNED_TO_HUB, RETURN_TO_MERCHANT
   */
  async getRiderReturns(riderId: string, tab: 'pending' | 'completed') {
    const where: any = { assigned_rider_id: riderId };

    if (tab === 'pending') {
      // Parcels marked as return via OTP verification, not yet returned to hub
      where.status = In([ParcelStatus.RETURNED, ParcelStatus.PAID_RETURN]);
    } else {
      // Parcels returned to hub or merchant
      where.status = In([
        ParcelStatus.RETURNED_TO_HUB,
        ParcelStatus.RETURN_TO_MERCHANT,
      ]);
    }

    return this.parcelRepository.find({
      where,
      relations: ['merchant', 'customer', 'store'],
      order: { updated_at: 'DESC' },
    });
  }

  /**
   * Rider accepts parcel assignment
   */
  async riderAcceptParcel(parcelId: string, riderId: string) {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, assigned_rider_id: riderId },
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found or not assigned to you');
    }

    if (parcel.status !== ParcelStatus.ASSIGNED_TO_RIDER) {
      throw new BadRequestException(
        `Cannot accept parcel with status: ${parcel.status}`,
      );
    }

    if (parcel.rider_accepted_at) {
      throw new ConflictException('Parcel already accepted');
    }

    parcel.rider_accepted_at = new Date();
    parcel.status = ParcelStatus.OUT_FOR_DELIVERY;
    parcel.out_for_delivery_at = new Date();

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[PARCEL ACCEPTED] Parcel: ${parcel.tracking_number}, Rider: ${riderId}`,
    );

    return parcel;
  }

  /**
   * Get parcel info for delivery (shows COD amount to rider)
   */
  async getParcelForDelivery(parcelId: string, riderId: string) {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, assigned_rider_id: riderId },
      relations: ['customer'],
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found or not assigned to you');
    }

    if (parcel.status !== ParcelStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException(
        `Parcel is not out for delivery. Current status: ${parcel.status}`,
      );
    }

    return parcel;
  }

  /**
   * Rider delivers parcel (DEPRECATED - use delivery-verifications flow)
   */
  async riderDeliverParcel(
    parcelId: string,
    riderId: string,
    deliveryProof?: string,
    signature?: string,
  ) {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, assigned_rider_id: riderId },
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found or not assigned to you');
    }

    if (parcel.status !== ParcelStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException(
        `Cannot deliver parcel with status: ${parcel.status}`,
      );
    }

    parcel.status = ParcelStatus.DELIVERED;
    parcel.delivered_at = new Date();
    parcel.payment_status = PaymentStatus.PAID;

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[PARCEL DELIVERED] Parcel: ${parcel.tracking_number}, Rider: ${riderId}`,
    );

    return parcel;
  }

  /**
   * Rider marks delivery as failed
   */
  async riderFailedDelivery(
    parcelId: string,
    riderId: string,
    reason: string,
    rescheduleDate?: Date,
  ) {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, assigned_rider_id: riderId },
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found or not assigned to you');
    }

    if (parcel.status !== ParcelStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException(
        `Cannot mark failed for parcel with status: ${parcel.status}`,
      );
    }

    parcel.status = ParcelStatus.FAILED_DELIVERY;
    parcel.return_reason = reason;

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[DELIVERY FAILED] Parcel: ${parcel.tracking_number}, Rider: ${riderId}, Reason: ${reason}`,
    );

    return parcel;
  }

  /**
   * Rider returns parcel to hub
   * Called after OTP verification marks parcel as RETURNED or PAID_RETURN
   */
  async riderReturnParcel(
    parcelId: string,
    riderId: string,
    returnReason: string,
  ) {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, assigned_rider_id: riderId },
      relations: ['assignedRider'],
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found or not assigned to you');
    }

    // Only allow return for OTP-verified return statuses
    const allowedStatuses = [ParcelStatus.RETURNED, ParcelStatus.PAID_RETURN];

    if (!allowedStatuses.includes(parcel.status)) {
      throw new BadRequestException(
        `Cannot return parcel with status: ${parcel.status}. ` +
          `Use delivery verification to mark as RETURNED or PAID_RETURN first.`,
      );
    }

    parcel.status = ParcelStatus.RETURNED_TO_HUB;
    parcel.return_reason = returnReason;
    parcel.assigned_rider_id = null as any;
    parcel.assigned_at = null as any;
    parcel.rider_accepted_at = null as any;
    parcel.out_for_delivery_at = null as any;

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[PARCEL RETURNED TO HUB] Parcel: ${parcel.tracking_number}, Rider: ${riderId}`,
    );

    return parcel;
  }

  /**
   * Get all hubs (for hub managers to see transfer destinations)
   */
  async getAllHubs(currentHubId?: string) {
    const hubs = await this.hubRepository.find({
      select: [
        'id',
        'hub_code',
        'branch_name',
        'area',
        'address',
        'manager_name',
        'manager_phone',
      ],
      order: { branch_name: 'ASC' },
    });

    // Exclude current hub if provided
    if (currentHubId) {
      return hubs.filter((hub) => hub.id !== currentHubId);
    }

    return hubs;
  }

  /**
   * Transfer parcel to another hub (Hub Manager)
   */
  async transferParcelToHub(
    parcelId: string,
    transferDto: TransferParcelDto,
    currentHubId: string,
  ): Promise<Parcel> {
    // Find parcel
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId },
      relations: ['currentHub', 'store', 'customer'],
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found');
    }

    // Verify parcel is in current hub
    if (parcel.current_hub_id && parcel.current_hub_id !== currentHubId) {
      throw new ForbiddenException('This parcel is not in your hub');
    }

    // Verify parcel status allows transfer
    const allowedStatuses = [ParcelStatus.IN_HUB, ParcelStatus.RETURNED_TO_HUB];
    if (!allowedStatuses.includes(parcel.status)) {
      throw new BadRequestException(
        `Cannot transfer parcel with status: ${parcel.status}. Parcel must be IN_HUB or RETURNED_TO_HUB`,
      );
    }

    // Verify destination hub exists and is active
    const destinationHub = await this.hubRepository.findOne({
      where: { id: transferDto.destination_hub_id },
    });

    if (!destinationHub) {
      throw new NotFoundException('Destination hub not found');
    }

    // Cannot transfer to same hub
    if (transferDto.destination_hub_id === currentHubId) {
      throw new BadRequestException('Cannot transfer parcel to the same hub');
    }

    // Set origin hub if not already set
    if (!parcel.origin_hub_id) {
      parcel.origin_hub_id = currentHubId;
    }

    // Update parcel for transfer
    parcel.current_hub_id = null as any; // In transit
    parcel.destination_hub_id = transferDto.destination_hub_id;
    parcel.is_inter_hub_transfer = true;
    parcel.transferred_at = new Date();
    parcel.transfer_notes = transferDto.transfer_notes || null;
    parcel.status = ParcelStatus.IN_TRANSIT;

    // Clear rider assignment if any
    parcel.assigned_rider_id = null as any;
    parcel.assigned_at = null as any;
    parcel.rider_accepted_at = null as any;

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[HUB TRANSFER] Parcel: ${parcel.tracking_number}, From Hub: ${currentHubId}, To Hub: ${transferDto.destination_hub_id}`,
    );

    return parcel;
  }

  /**
   * Get parcels in transit to this hub (Hub Manager)
   */
  async getIncomingParcels(
    hubId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.originHub', 'originHub')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .where('parcel.destination_hub_id = :hubId', { hubId })
      .andWhere('parcel.status = :status', { status: ParcelStatus.IN_TRANSIT })
      .andWhere('parcel.received_at_destination_hub IS NULL')
      .orderBy('parcel.transferred_at', 'DESC')
      .skip(skip)
      .take(limit);

    const [parcels, total] = await queryBuilder.getManyAndCount();

    return {
      parcels,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Accept incoming parcel at destination hub (Hub Manager)
   */
  async acceptIncomingParcel(parcelId: string, hubId: string): Promise<Parcel> {
    // Find parcel
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId },
      relations: ['originHub', 'destinationHub', 'store', 'customer'],
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found');
    }

    // Verify parcel is destined for this hub
    if (parcel.destination_hub_id !== hubId) {
      throw new ForbiddenException('This parcel is not destined for your hub');
    }

    // Verify parcel is in transit
    if (parcel.status !== ParcelStatus.IN_TRANSIT) {
      throw new BadRequestException(
        `Cannot accept parcel with status: ${parcel.status}. Parcel must be IN_TRANSIT`,
      );
    }

    // Verify not already received
    if (parcel.received_at_destination_hub) {
      throw new ConflictException('Parcel has already been received');
    }

    // Accept parcel
    parcel.current_hub_id = hubId;
    parcel.destination_hub_id = null as any;
    parcel.received_at_destination_hub = new Date();
    parcel.status = ParcelStatus.IN_HUB;

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[HUB RECEIVE] Parcel: ${parcel.tracking_number}, Received at Hub: ${hubId}`,
    );

    return parcel;
  }

  /**
   * Get parcels transferred from this hub (Hub Manager)
   */
  async getOutgoingParcels(
    hubId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.destinationHub', 'destinationHub')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .where('parcel.origin_hub_id = :hubId', { hubId })
      .andWhere('parcel.is_inter_hub_transfer = :isTransfer', {
        isTransfer: true,
      })
      .orderBy('parcel.transferred_at', 'DESC')
      .skip(skip)
      .take(limit);

    const [parcels, total] = await queryBuilder.getManyAndCount();

    return {
      parcels,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get delivery outcomes for Hub Manager
   * Shows parcels with: PARTIAL_DELIVERY, EXCHANGE, DELIVERY_RESCHEDULED, PAID_RETURN, RETURNED
   *
   * WHY: Hub managers need to track parcels that didn't complete normally
   * - Partial deliveries may need follow-up
   * - Exchanges need processing
   * - Rescheduled deliveries need planning
   * - Returns need to be received back at hub
   */
  async getDeliveryOutcomes(
    hubId: string,
    options: {
      status?: ParcelStatus;
      zone?: string;
      merchantId?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { status, zone, merchantId, page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    // Define delivery outcome statuses (for returns/exchanges)
    // Note: DELIVERY_RESCHEDULED has separate endpoint
    const outcomeStatuses = [
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.PAID_RETURN,
      ParcelStatus.RETURNED,
    ];

    // Build query
    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.merchant', 'merchant')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('parcel.delivery_coverage_area', 'coverageArea')
      .where('parcel.current_hub_id = :hubId', { hubId });

    // Filter by outcome statuses (or specific status if provided)
    if (status && outcomeStatuses.includes(status)) {
      queryBuilder.andWhere('parcel.status = :status', { status });
    } else {
      queryBuilder.andWhere('parcel.status IN (:...statuses)', {
        statuses: outcomeStatuses,
      });
    }

    // Filter by zone (using coverage area zone or area field)
    if (zone) {
      queryBuilder.andWhere(
        '(coverageArea.zone ILIKE :zone OR coverageArea.area ILIKE :zone)',
        { zone: `%${zone}%` },
      );
    }

    // Filter by merchant
    if (merchantId) {
      queryBuilder.andWhere('parcel.merchant_id = :merchantId', { merchantId });
    }

    // Order by most recent first
    queryBuilder.orderBy('parcel.updated_at', 'DESC');

    // Get total count for pagination
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    const parcels = await queryBuilder.getMany();

    // Transform parcels to response format
    const items = parcels.map((parcel) => this.toDeliveryOutcomeItem(parcel));

    return {
      parcels: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get rescheduled deliveries for Hub Manager
   * These parcels need to be re-assigned to a rider for redelivery
   */
  async getRescheduledDeliveries(
    hubId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.merchant', 'merchant')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('parcel.delivery_coverage_area', 'coverageArea')
      .leftJoinAndSelect('parcel.assignedRider', 'rider')
      .where('parcel.current_hub_id = :hubId', { hubId })
      .andWhere('parcel.status = :status', {
        status: ParcelStatus.DELIVERY_RESCHEDULED,
      })
      .orderBy('parcel.updated_at', 'DESC');

    const total = await queryBuilder.getCount();
    queryBuilder.skip(skip).take(limit);
    const parcels = await queryBuilder.getMany();

    const items = parcels.map((parcel) => this.toDeliveryOutcomeItem(parcel));

    return {
      parcels: items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Hub Manager marks parcel as RETURN_TO_MERCHANT
   * Creates a NEW return parcel to track the return journey back to merchant
   *
   * Used for: RETURNED, PAID_RETURN, PARTIAL_DELIVERY, EXCHANGE outcomes
   */
  async markReturnToMerchant(parcelId: string, hubId: string, notes?: string) {
    const originalParcel = await this.parcelRepository.findOne({
      where: { id: parcelId, current_hub_id: hubId },
      relations: ['store', 'merchant'],
    });

    if (!originalParcel) {
      throw new NotFoundException('Parcel not found in your hub');
    }

    const allowedStatuses = [
      ParcelStatus.RETURNED,
      ParcelStatus.PAID_RETURN,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.RETURNED_TO_HUB,
    ];

    if (!allowedStatuses.includes(originalParcel.status)) {
      throw new BadRequestException(
        `Cannot mark as return to merchant. Current status: ${originalParcel.status}`,
      );
    }

    // Mark original parcel as RETURN_TO_MERCHANT
    originalParcel.status = ParcelStatus.RETURN_TO_MERCHANT;
    if (notes) {
      originalParcel.admin_notes = notes;
    }
    await this.parcelRepository.save(originalParcel);

    // Create a NEW return parcel to track the return journey
    const returnTrackingNumber = await this.generateReturnTrackingNumber(
      originalParcel.tracking_number,
    );

    const returnParcel = this.parcelRepository.create({
      // Tracking
      tracking_number: returnTrackingNumber,
      merchant_order_id: originalParcel.merchant_order_id,

      // Link to original
      original_parcel_id: originalParcel.id,
      is_return_parcel: true,

      // Merchant info
      merchant_id: originalParcel.merchant_id,
      store_id: originalParcel.store_id,

      // For return: pickup from customer address, deliver to merchant/store
      pickup_address: originalParcel.delivery_address,
      delivery_address: originalParcel.pickup_address,

      // Customer info (original merchant becomes recipient)
      customer_name: originalParcel.store?.business_name || 'Merchant',
      customer_phone:
        originalParcel.store?.phone_number ||
        originalParcel.merchant?.phone ||
        '',

      // Parcel details
      product_description: `RETURN: ${originalParcel.product_description || 'N/A'}`,
      product_price: originalParcel.product_price,
      product_weight: originalParcel.product_weight,
      parcel_type: originalParcel.parcel_type,

      // No COD for returns (merchant handles refund separately)
      is_cod: false,
      cod_amount: 0,
      delivery_charge: 0, // Return charges handled separately
      weight_charge: 0,
      cod_charge: 0,
      total_charge: 0,

      // Status
      status: ParcelStatus.IN_HUB, // Ready to be assigned for return
      payment_status: PaymentStatus.UNPAID,

      // Hub
      current_hub_id: hubId,

      // Reason
      return_reason:
        originalParcel.return_reason || notes || 'Return to merchant',
    });

    await this.parcelRepository.save(returnParcel);

    this.logger.log(
      `[RETURN TO MERCHANT] Original: ${originalParcel.tracking_number}, ` +
        `Return Parcel: ${returnParcel.tracking_number}, Hub: ${hubId}`,
    );

    return {
      original_parcel: originalParcel,
      return_parcel: returnParcel,
    };
  }

  /**
   * Generate tracking number for return parcel
   * Format: RTN-{original_tracking}-{sequence}
   */
  private async generateReturnTrackingNumber(
    originalTracking: string,
  ): Promise<string> {
    // Check if this is already a return (has RTN prefix)
    if (originalTracking.startsWith('RTN-')) {
      // Extract base tracking and increment
      const parts = originalTracking.split('-');
      const sequence = parseInt(parts[parts.length - 1]) || 1;
      parts[parts.length - 1] = String(sequence + 1);
      return parts.join('-');
    }

    return `RTN-${originalTracking}`;
  }

  /**
   * Hub Manager prepares rescheduled parcel for redelivery
   * Resets parcel to IN_HUB so it can be assigned to rider again
   */
  async prepareForRedelivery(parcelId: string, hubId: string) {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, current_hub_id: hubId },
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found in your hub');
    }

    if (parcel.status !== ParcelStatus.DELIVERY_RESCHEDULED) {
      throw new BadRequestException(
        `Parcel is not rescheduled. Current status: ${parcel.status}`,
      );
    }

    // Reset to IN_HUB for reassignment
    parcel.status = ParcelStatus.IN_HUB;
    parcel.assigned_rider_id = null;
    parcel.assigned_at = null;
    parcel.rider_accepted_at = null;
    parcel.out_for_delivery_at = null;

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[PREPARE REDELIVERY] Parcel: ${parcel.tracking_number}, Hub: ${hubId}`,
    );

    return parcel;
  }

  /**
   * Helper: Calculate age display string
   * Converts time difference to human-readable format: "2 days 3h 15m"
   */
  private calculateAge(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

    return parts.join(' ');
  }

  /**
   * Helper: Transform parcel to delivery outcome item format
   */
  private toDeliveryOutcomeItem(parcel: Parcel) {
    // Build zone string from coverage area
    const zoneInfo = parcel.delivery_coverage_area
      ? `${parcel.delivery_coverage_area.area}, ${parcel.delivery_coverage_area.zone}`
      : null;

    return {
      parcel_id: parcel.id,
      tracking_number: parcel.tracking_number,
      original_parcel_id: parcel.original_parcel_id || null,
      is_return_parcel: parcel.is_return_parcel || false,
      status: parcel.status,
      reason: parcel.return_reason || null,

      destination: {
        address: parcel.delivery_address,
        zone: zoneInfo,
      },

      merchant: {
        name:
          parcel.store?.business_name || parcel.merchant?.full_name || 'N/A',
        phone: parcel.store?.phone_number || parcel.merchant?.phone || 'N/A',
      },

      cod: {
        total_charge: Number(parcel.total_charge) || 0,
        delivery_charge: Number(parcel.delivery_charge) || 0,
        cod_charge: Number(parcel.cod_charge) || 0,
        weight_charge: Number(parcel.weight_charge) || 0,
        cod_amount: Number(parcel.cod_amount) || 0,
      },

      age: {
        display: this.calculateAge(parcel.created_at),
        created_at: parcel.created_at,
        updated_at: parcel.updated_at,
      },
    };
  }
}
