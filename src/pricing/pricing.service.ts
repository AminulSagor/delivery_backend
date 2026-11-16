import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricingConfiguration } from './entities/pricing-configuration.entity';
import { CreatePricingConfigurationDto } from './dto/create-pricing-configuration.dto';
import { UpdatePricingConfigurationDto } from './dto/update-pricing-configuration.dto';
import { PricingZone } from '../common/enums/pricing-zone.enum';
import {
  ReturnChargeConfiguration,
  ReturnStatus,
} from './entities/return-charge-configuration.entity';
import { CreateReturnChargeConfigDto } from './dto/create-return-charge-config.dto';
import { UpdateReturnChargeConfigDto } from './dto/update-return-charge-config.dto';
import { BulkCreateReturnChargesDto } from './dto/bulk-create-return-charges.dto';
import { WeightChargeCalculationResult } from './dto/calculate-weight-charge.dto';
import { PricingDefaultConfiguration } from './entities/pricing-default-configuration.entity';
import { ReturnChargeDefaultConfiguration } from './entities/return-charge-default-configuration.entity';
import { UpsertPricingDefaultsDto } from './dto/upsert-pricing-defaults.dto';

/**
 * FIXED weight charge values per zone
 * These values are NOT configurable by admin
 */
const FIXED_FREE_WEIGHT_KG = 0.5; // First 0.5 kg is always FREE

const FIXED_CHARGE_PER_STEP: Record<PricingZone, number> = {
  [PricingZone.INSIDE_DHAKA]: 10, // 10 BDT per step
  [PricingZone.SUB_DHAKA]: 20, // 20 BDT per step
  [PricingZone.OUTSIDE_DHAKA]: 20, // 20 BDT per step
};

/**
 * Default pricing configurations per zone
 * Admin can configure: delivery_charge, weight_step_kg, cod_percentage
 * Fixed values: free_weight_kg (0.5), charge_per_step (10/20)
 */
const DEFAULT_PRICING_CONFIGS: Record<
  PricingZone,
  {
    delivery_charge: number;
    weight_step_kg: number;
    cod_percentage: number;
    discount_percentage: number;
  }
> = {
  [PricingZone.INSIDE_DHAKA]: {
    delivery_charge: 70,
    weight_step_kg: 0.5,
    cod_percentage: 0.0,
    discount_percentage: 0,
  },
  [PricingZone.SUB_DHAKA]: {
    delivery_charge: 90,
    weight_step_kg: 1.0,
    cod_percentage: 1.0,
    discount_percentage: 0,
  },
  [PricingZone.OUTSIDE_DHAKA]: {
    delivery_charge: 110,
    weight_step_kg: 1.0,
    cod_percentage: 1.0,
    discount_percentage: 0,
  },
};

const DEFAULT_START_DATE = new Date('2026-01-01T00:00:00.000Z');
const DEFAULT_END_DATE = new Date('2099-12-31T23:59:59.999Z');

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    @InjectRepository(PricingConfiguration)
    private pricingRepository: Repository<PricingConfiguration>,
    @InjectRepository(ReturnChargeConfiguration)
    private returnChargeRepository: Repository<ReturnChargeConfiguration>,
    @InjectRepository(PricingDefaultConfiguration)
    private pricingDefaultRepository: Repository<PricingDefaultConfiguration>,
    @InjectRepository(ReturnChargeDefaultConfiguration)
    private returnChargeDefaultRepository: Repository<ReturnChargeDefaultConfiguration>,
  ) {}

  /**
   * Return the complete default matrix. Database values override the safe
   * bootstrap values so the API remains usable before the first admin update.
   */
  async getPricingDefaults(
    requestedZone?: PricingZone,
  ): Promise<Record<string, any>> {
    if (requestedZone && !Object.values(PricingZone).includes(requestedZone)) {
      throw new BadRequestException(`Invalid pricing zone: ${requestedZone}`);
    }

    const zones = requestedZone ? [requestedZone] : Object.values(PricingZone);
    const [deliveryRows, returnRows] = await Promise.all([
      this.pricingDefaultRepository.find(),
      this.returnChargeDefaultRepository.find(),
    ]);

    const deliveryMap = new Map(deliveryRows.map((row) => [row.zone, row]));
    const returnMap = new Map(
      returnRows.map((row) => [`${row.zone}:${row.return_status}`, row]),
    );

    const deliveryCharges: Record<string, any> = {};
    const returnCharges: Record<string, any> = {};

    for (const zone of zones) {
      const delivery = deliveryMap.get(zone);
      const bootstrap = DEFAULT_PRICING_CONFIGS[zone];
      deliveryCharges[zone] = delivery
        ? {
            id: delivery.id,
            zone,
            delivery_charge: Number(delivery.delivery_charge),
            weight_step_kg: Number(delivery.weight_step_kg),
            cod_percentage: Number(delivery.cod_percentage),
            discount_percentage: Number(delivery.discount_percentage),
            start_date: delivery.start_date,
            end_date: delivery.end_date,
            created_at: delivery.created_at,
            updated_at: delivery.updated_at,
          }
        : {
            id: null,
            zone,
            ...bootstrap,
            start_date: DEFAULT_START_DATE,
            end_date: DEFAULT_END_DATE,
            created_at: null,
            updated_at: null,
          };

      const statuses: Record<string, any> = {};
      for (const status of Object.values(ReturnStatus)) {
        const returnConfig = returnMap.get(`${zone}:${status}`);
        statuses[status] = returnConfig
          ? {
              id: returnConfig.id,
              zone,
              return_status: status,
              return_delivery_charge: Number(
                returnConfig.return_delivery_charge,
              ),
              return_weight_charge_per_kg: Number(
                returnConfig.return_weight_charge_per_kg,
              ),
              return_cod_percentage: Number(returnConfig.return_cod_percentage),
              discount_percentage: Number(returnConfig.discount_percentage),
              start_date: returnConfig.start_date,
              end_date: returnConfig.end_date,
              created_at: returnConfig.created_at,
              updated_at: returnConfig.updated_at,
            }
          : {
              id: null,
              zone,
              return_status: status,
              return_delivery_charge: 0,
              return_weight_charge_per_kg: 0,
              return_cod_percentage: 0,
              discount_percentage: 0,
              start_date: DEFAULT_START_DATE,
              end_date: DEFAULT_END_DATE,
              created_at: null,
              updated_at: null,
            };
      }
      returnCharges[zone] = statuses;
    }

    return {
      delivery_charges: deliveryCharges,
      return_charges: returnCharges,
    };
  }

  /** Atomically replace all 3 delivery and all 12 return defaults. */
  async upsertPricingDefaults(
    dto: UpsertPricingDefaultsDto,
  ): Promise<Record<string, any>> {
    this.validateCompleteDefaults(dto);

    await this.pricingDefaultRepository.manager.transaction(async (manager) => {
      const deliveryRepository = manager.getRepository(
        PricingDefaultConfiguration,
      );
      const returnRepository = manager.getRepository(
        ReturnChargeDefaultConfiguration,
      );

      for (const input of dto.delivery_charges) {
        const existing = await deliveryRepository.findOne({
          where: { zone: input.zone },
        });
        const entity =
          existing ?? deliveryRepository.create({ zone: input.zone });
        Object.assign(entity, {
          delivery_charge: input.delivery_charge,
          weight_step_kg: input.weight_step_kg,
          cod_percentage: input.cod_percentage,
          discount_percentage: input.discount_percentage,
          start_date: input.start_date ? new Date(input.start_date) : null,
          end_date: input.end_date ? new Date(input.end_date) : null,
        });
        await deliveryRepository.save(entity);
      }

      for (const input of dto.return_charges) {
        const existing = await returnRepository.findOne({
          where: { zone: input.zone, return_status: input.return_status },
        });
        const entity =
          existing ??
          returnRepository.create({
            zone: input.zone,
            return_status: input.return_status,
          });
        Object.assign(entity, {
          return_delivery_charge: input.return_delivery_charge,
          return_weight_charge_per_kg: input.return_weight_charge_per_kg,
          return_cod_percentage: input.return_cod_percentage,
          discount_percentage: input.discount_percentage,
          start_date: input.start_date ? new Date(input.start_date) : null,
          end_date: input.end_date ? new Date(input.end_date) : null,
        });
        await returnRepository.save(entity);
      }
    });

    return this.getPricingDefaults();
  }

  private validateCompleteDefaults(dto: UpsertPricingDefaultsDto): void {
    const zones = Object.values(PricingZone);
    const statuses = Object.values(ReturnStatus);
    const deliveryKeys = dto.delivery_charges.map((item) => item.zone);
    const returnKeys = dto.return_charges.map(
      (item) => `${item.zone}:${item.return_status}`,
    );

    if (
      deliveryKeys.length !== zones.length ||
      new Set(deliveryKeys).size !== zones.length ||
      !zones.every((zone) => deliveryKeys.includes(zone))
    ) {
      throw new BadRequestException(
        'delivery_charges must contain each pricing zone exactly once',
      );
    }

    const expectedReturnKeys = zones.flatMap((zone) =>
      statuses.map((status) => `${zone}:${status}`),
    );
    if (
      returnKeys.length !== expectedReturnKeys.length ||
      new Set(returnKeys).size !== expectedReturnKeys.length ||
      !expectedReturnKeys.every((key) => returnKeys.includes(key))
    ) {
      throw new BadRequestException(
        'return_charges must contain every zone and return status exactly once',
      );
    }

    for (const item of [...dto.delivery_charges, ...dto.return_charges]) {
      if (
        item.start_date &&
        item.end_date &&
        new Date(item.start_date) > new Date(item.end_date)
      ) {
        throw new BadRequestException(
          `start_date must not be after end_date for zone ${item.zone}`,
        );
      }
    }
  }

  /**
   * Get active pricing configuration for a store and zone
   */
  async getActivePricing(
    storeId: string,
    zone: PricingZone,
  ): Promise<PricingConfiguration | null> {
    const now = new Date();

    const pricing = await this.pricingRepository.findOne({
      where: {
        store_id: storeId,
        zone: zone,
      },
      order: {
        created_at: 'DESC', // Get the most recent one
      },
    });

    if (!pricing) {
      console.log(
        `[PRICING] No pricing found for Store: ${storeId}, Zone: ${zone}`,
      );
      return null;
    }

    // Check date validity
    if (pricing.start_date && pricing.start_date > now) {
      console.log(
        `[PRICING] Pricing not yet active (starts ${pricing.start_date})`,
      );
      return null;
    }

    if (pricing.end_date && pricing.end_date < now) {
      console.log(`[PRICING] Pricing expired (ended ${pricing.end_date})`);
      return null;
    }

    console.log(
      `[PRICING] Active pricing found for Store: ${storeId}, Zone: ${zone}, Delivery: ${pricing.delivery_charge} BDT`,
    );
    return pricing;
  }

  /**
   * Create new pricing configuration for a store + zone
   *
   * Admin configures: delivery_charge, weight_step_kg, cod_percentage
   * Fixed values: free_weight_kg (0.5), charge_per_step (10/20 based on zone)
   */
  async create(
    createDto: CreatePricingConfigurationDto,
  ): Promise<PricingConfiguration> {
    // Check for duplicate (same store + zone) - Upsert behavior
    const existing = await this.pricingRepository.findOne({
      where: {
        store_id: createDto.store_id,
        zone: createDto.zone,
      },
    });

    if (existing) {
      // Update existing configuration instead of throwing ConflictException
      Object.assign(existing, {
        delivery_charge: createDto.delivery_charge,
        weight_step_kg: createDto.weight_step_kg,
        cod_percentage: createDto.cod_percentage,
        discount_percentage: createDto.discount_percentage ?? null,
        start_date: createDto.start_date
          ? new Date(createDto.start_date)
          : null,
        end_date: createDto.end_date ? new Date(createDto.end_date) : null,
      });

      const updated = await this.pricingRepository.save(existing);

      this.logger.log(
        `[PRICING UPDATED (UPSERT)] Store: ${updated.store_id}, Zone: ${updated.zone}, ` +
          `Delivery: ${updated.delivery_charge} BDT, Step: ${updated.weight_step_kg}kg, ` +
          `COD: ${updated.cod_percentage}%`,
      );

      return updated;
    }

    // Create new configuration
    const pricing = this.pricingRepository.create({
      store_id: createDto.store_id,
      zone: createDto.zone,
      delivery_charge: createDto.delivery_charge,
      weight_step_kg: createDto.weight_step_kg,
      cod_percentage: createDto.cod_percentage,
      discount_percentage: createDto.discount_percentage ?? null,
      start_date: createDto.start_date ? new Date(createDto.start_date) : null,
      end_date: createDto.end_date ? new Date(createDto.end_date) : null,
    });

    const saved = await this.pricingRepository.save(pricing);

    // Get fixed charge per step for logging
    const chargePerStep = FIXED_CHARGE_PER_STEP[createDto.zone];

    this.logger.log(
      `[PRICING CREATED] Store: ${saved.store_id}, Zone: ${saved.zone}, ` +
        `Delivery: ${saved.delivery_charge} BDT, Step: ${saved.weight_step_kg}kg, ` +
        `Charge/Step: ${chargePerStep} BDT (fixed), COD: ${saved.cod_percentage}%`,
    );

    return saved;
  }

  /** Get store pricing, falling back to the global defaults per field group. */
  async findAllForStore(storeId: string): Promise<Record<string, any>> {
    const configs = await this.pricingRepository.find({
      where: { store_id: storeId },
      order: { zone: 'ASC', created_at: 'DESC' },
    });

    // Keep only the most recent config per zone
    const configMap: Record<string, PricingConfiguration> = {};
    for (const config of configs) {
      if (!configMap[config.zone]) {
        configMap[config.zone] = config;
      }
    }

    const defaults = await this.getPricingDefaults();
    const returnCharges = await this.getReturnChargesForStore(
      storeId,
      defaults.return_charges,
    );

    const deliveryCharges: Record<string, any> = {};
    for (const zone of Object.values(PricingZone)) {
      const config = configMap[zone];
      if (config) {
        deliveryCharges[zone] = {
          id: config.id,
          store_id: config.store_id,
          zone: config.zone,
          delivery_charge: Number(config.delivery_charge),
          weight_step_kg: Number(config.weight_step_kg),
          cod_percentage: Number(config.cod_percentage),
          discount_percentage: config.discount_percentage
            ? Number(config.discount_percentage)
            : 0,
          start_date: config.start_date,
          end_date: config.end_date,
          created_at: config.created_at,
          updated_at: config.updated_at,
          is_default: false,
        };
      } else {
        const defaultConfig = defaults.delivery_charges[zone];
        deliveryCharges[zone] = {
          id: null,
          store_id: storeId,
          zone,
          delivery_charge: defaultConfig.delivery_charge,
          weight_step_kg: defaultConfig.weight_step_kg,
          cod_percentage: defaultConfig.cod_percentage,
          discount_percentage: defaultConfig.discount_percentage,
          start_date: defaultConfig.start_date,
          end_date: defaultConfig.end_date,
          created_at: null,
          updated_at: null,
          is_default: true,
        };
      }
    }

    return {
      delivery_charges: deliveryCharges,
      return_charges: returnCharges,
    };
  }

  /**
   * Get all pricing configurations (admin only), grouped by store then by zone with 0-fill
   */
  async findAll(): Promise<any[]> {
    const configs = await this.pricingRepository.find({
      relations: ['store'],
      order: { created_at: 'DESC' },
    });

    // Group by store_id
    const storeMap: Record<
      string,
      { store: any; configs: Record<string, PricingConfiguration> }
    > = {};

    for (const config of configs) {
      if (!storeMap[config.store_id]) {
        storeMap[config.store_id] = {
          store: config.store || { id: config.store_id },
          configs: {},
        };
      }
      // Keep only the most recent config per zone
      if (!storeMap[config.store_id].configs[config.zone]) {
        storeMap[config.store_id].configs[config.zone] = config;
      }
    }

    // Build grouped result with 0-fill for missing zones
    return Object.values(storeMap).map(({ store, configs: zoneConfigs }) => {
      const zones: Record<string, any> = {};
      for (const zone of Object.values(PricingZone)) {
        const config = zoneConfigs[zone];
        if (config) {
          zones[zone] = {
            id: config.id,
            delivery_charge: Number(config.delivery_charge),
            weight_step_kg: Number(config.weight_step_kg),
            cod_percentage: Number(config.cod_percentage),
            discount_percentage: config.discount_percentage
              ? Number(config.discount_percentage)
              : 0,
            start_date: config.start_date,
            end_date: config.end_date,
            created_at: config.created_at,
            updated_at: config.updated_at,
          };
        } else {
          zones[zone] = {
            id: null,
            delivery_charge: 0,
            weight_step_kg: 0,
            cod_percentage: 0,
            discount_percentage: 0,
            start_date: null,
            end_date: null,
            created_at: null,
            updated_at: null,
          };
        }
      }
      return {
        store_id: store.id,
        store,
        zones,
      };
    });
  }

  /**
   * Get single pricing configuration
   */
  async findOne(id: string): Promise<PricingConfiguration> {
    const pricing = await this.pricingRepository.findOne({
      where: { id },
    });

    if (!pricing) {
      throw new NotFoundException(
        `Pricing configuration with ID ${id} not found`,
      );
    }

    return pricing;
  }

  /**
   * Update pricing configuration
   */
  async update(
    id: string,
    updateDto: UpdatePricingConfigurationDto,
  ): Promise<PricingConfiguration> {
    const pricing = await this.findOne(id);

    Object.assign(pricing, updateDto);

    const updated = await this.pricingRepository.save(pricing);

    console.log(`[PRICING UPDATED] ID: ${id}, Zone: ${updated.zone}`);

    return updated;
  }

  /**
   * Delete pricing configuration
   */
  async remove(id: string): Promise<void> {
    const pricing = await this.findOne(id);
    await this.pricingRepository.remove(pricing);

    console.log(`[PRICING DELETED] ID: ${id}`);
  }

  // ===== RETURN CHARGE CONFIGURATION METHODS =====

  /**
   * Get active return charge for a store, status, and zone
   */
  async getActiveReturnCharge(
    storeId: string,
    returnStatus: ReturnStatus,
    zone: PricingZone,
  ): Promise<ReturnChargeConfiguration | null> {
    const now = new Date();

    const config = await this.returnChargeRepository.findOne({
      where: {
        store_id: storeId,
        return_status: returnStatus,
        zone: zone,
      },
      order: {
        created_at: 'DESC',
      },
    });

    if (!config) {
      console.log(
        `[RETURN CHARGE] No config found for Store: ${storeId}, Status: ${returnStatus}, Zone: ${zone}`,
      );
      return null;
    }

    // Check date validity
    if (config.start_date && config.start_date > now) {
      console.log(
        `[RETURN CHARGE] Config not yet active (starts ${config.start_date})`,
      );
      return null;
    }

    if (config.end_date && config.end_date < now) {
      console.log(`[RETURN CHARGE] Config expired (ended ${config.end_date})`);
      return null;
    }

    console.log(
      `[RETURN CHARGE] Active config found for Store: ${storeId}, Status: ${returnStatus}, Zone: ${zone}, Charge: ${config.return_delivery_charge} BDT`,
    );
    return config;
  }

  /**
   * Create single return charge configuration
   */
  async createReturnCharge(
    dto: CreateReturnChargeConfigDto,
  ): Promise<ReturnChargeConfiguration> {
    if (dto.start_date && dto.end_date) {
      const start = new Date(dto.start_date);
      const end = new Date(dto.end_date);
      if (end < start) {
        throw new BadRequestException('end_date must be after start_date');
      }
    }

    const existing = await this.returnChargeRepository.findOne({
      where: {
        store_id: dto.store_id,
        zone: dto.zone,
        return_status: dto.return_status,
      },
    });

    if (existing) {
      Object.assign(existing, {
        return_delivery_charge: dto.return_delivery_charge || 0,
        return_weight_charge_per_kg: dto.return_weight_charge_per_kg || 0,
        return_cod_percentage: dto.return_cod_percentage || 0,
        discount_percentage: dto.discount_percentage || 0,
        start_date: dto.start_date ? new Date(dto.start_date) : null,
        end_date: dto.end_date ? new Date(dto.end_date) : null,
      });

      const updated = await this.returnChargeRepository.save(existing);
      console.log(
        `[RETURN CHARGE UPSERTED] Store: ${updated.store_id}, Status: ${updated.return_status}, ` +
          `Zone: ${updated.zone}, Delivery: ${updated.return_delivery_charge} BDT`,
      );
      return updated;
    }

    const config = this.returnChargeRepository.create({
      store_id: dto.store_id,
      zone: dto.zone,
      return_status: dto.return_status,
      return_delivery_charge: dto.return_delivery_charge || 0,
      return_weight_charge_per_kg: dto.return_weight_charge_per_kg || 0,
      return_cod_percentage: dto.return_cod_percentage || 0,
      discount_percentage: dto.discount_percentage || 0,
      start_date: dto.start_date ? new Date(dto.start_date) : null,
      end_date: dto.end_date ? new Date(dto.end_date) : null,
    });

    const saved = await this.returnChargeRepository.save(config);

    console.log(
      `[RETURN CHARGE CREATED] Store: ${saved.store_id}, Status: ${saved.return_status}, ` +
        `Zone: ${saved.zone}, Delivery: ${saved.return_delivery_charge} BDT`,
    );

    return saved;
  }

  /**
   * Bulk create return charges for all statuses at once
   */
  async bulkCreateReturnCharges(
    dto: BulkCreateReturnChargesDto,
  ): Promise<ReturnChargeConfiguration[]> {
    const savedConfigs: ReturnChargeConfiguration[] = [];
    const statusCharges = dto.status_charges ?? dto.configurations ?? [];

    if (statusCharges.length === 0) {
      throw new BadRequestException(
        'Either status_charges or configurations must be provided with at least one item',
      );
    }

    for (const statusCharge of statusCharges) {
      const discountPercentage =
        statusCharge.discount_percentage ?? dto.discount_percentage ?? 0;
      const startDate = statusCharge.start_date ?? dto.start_date;
      const endDate = statusCharge.end_date ?? dto.end_date;

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end < start) {
          throw new BadRequestException('end_date must be after start_date');
        }
      }

      // Find existing config for this store, zone, and status
      const existing = await this.returnChargeRepository.findOne({
        where: {
          store_id: dto.store_id,
          zone: dto.zone,
          return_status: statusCharge.return_status,
        },
      });

      if (existing) {
        // Upsert behavior
        Object.assign(existing, {
          return_delivery_charge: statusCharge.return_delivery_charge || 0,
          return_weight_charge_per_kg:
            statusCharge.return_weight_charge_per_kg || 0,
          return_cod_percentage: statusCharge.return_cod_percentage || 0,
          discount_percentage: discountPercentage,
          start_date: startDate ? new Date(startDate) : null,
          end_date: endDate ? new Date(endDate) : null,
        });
        const updated = await this.returnChargeRepository.save(existing);
        savedConfigs.push(updated);
      } else {
        // Create new
        const config = this.returnChargeRepository.create({
          store_id: dto.store_id,
          zone: dto.zone,
          return_status: statusCharge.return_status,
          return_delivery_charge: statusCharge.return_delivery_charge || 0,
          return_weight_charge_per_kg:
            statusCharge.return_weight_charge_per_kg || 0,
          return_cod_percentage: statusCharge.return_cod_percentage || 0,
          discount_percentage: discountPercentage,
          start_date: startDate ? new Date(startDate) : null,
          end_date: endDate ? new Date(endDate) : null,
        });
        const saved = await this.returnChargeRepository.save(config);
        savedConfigs.push(saved);
      }
    }

    console.log(
      `[RETURN CHARGES BULK UPSERTED] Store: ${dto.store_id}, Zone: ${dto.zone}, Count: ${savedConfigs.length}`,
    );

    return savedConfigs;
  }

  /**
   * Get all return charge configs for a store, grouped by zone then return_status with 0-fill
   */
  async getReturnChargesForStore(
    storeId: string,
    defaultReturnCharges?: Record<string, any>,
  ): Promise<Record<string, any>> {
    const configs = await this.returnChargeRepository.find({
      where: { store_id: storeId },
      order: { zone: 'ASC', return_status: 'ASC' },
    });

    // Build lookup map: zone -> return_status -> config
    const configMap: Record<
      string,
      Record<string, ReturnChargeConfiguration>
    > = {};
    for (const config of configs) {
      if (!configMap[config.zone]) {
        configMap[config.zone] = {};
      }
      configMap[config.zone][config.return_status] = config;
    }

    const defaults =
      defaultReturnCharges ?? (await this.getPricingDefaults()).return_charges;
    const result: Record<string, any> = {};
    for (const zone of Object.values(PricingZone)) {
      const statuses: Record<string, any> = {};
      for (const status of Object.values(ReturnStatus)) {
        const config = configMap[zone]?.[status];
        if (config) {
          statuses[status] = {
            id: config.id,
            return_delivery_charge: Number(config.return_delivery_charge),
            return_weight_charge_per_kg: Number(
              config.return_weight_charge_per_kg,
            ),
            return_cod_percentage: Number(config.return_cod_percentage),
            discount_percentage: config.discount_percentage
              ? Number(config.discount_percentage)
              : 0,
            start_date: config.start_date,
            end_date: config.end_date,
            created_at: config.created_at,
            updated_at: config.updated_at,
            is_default: false,
          };
        } else {
          const defaultConfig = defaults[zone][status];
          statuses[status] = {
            id: null,
            return_delivery_charge: defaultConfig.return_delivery_charge,
            return_weight_charge_per_kg:
              defaultConfig.return_weight_charge_per_kg,
            return_cod_percentage: defaultConfig.return_cod_percentage,
            discount_percentage: defaultConfig.discount_percentage,
            start_date: defaultConfig.start_date,
            end_date: defaultConfig.end_date,
            created_at: null,
            updated_at: null,
            is_default: true,
          };
        }
      }
      result[zone] = statuses;
    }

    return result;
  }

  /**
   * Get all return charge configurations (admin only), grouped by store then zone then status with 0-fill
   */
  async findAllReturnCharges(): Promise<any[]> {
    const configs = await this.returnChargeRepository.find({
      relations: ['store'],
      order: { created_at: 'DESC' },
    });

    // Group by store_id -> zone -> return_status
    const storeMap: Record<
      string,
      {
        store: any;
        configs: Record<string, Record<string, ReturnChargeConfiguration>>;
      }
    > = {};

    for (const config of configs) {
      if (!storeMap[config.store_id]) {
        storeMap[config.store_id] = {
          store: config.store || { id: config.store_id },
          configs: {},
        };
      }
      if (!storeMap[config.store_id].configs[config.zone]) {
        storeMap[config.store_id].configs[config.zone] = {};
      }
      if (
        !storeMap[config.store_id].configs[config.zone][config.return_status]
      ) {
        storeMap[config.store_id].configs[config.zone][config.return_status] =
          config;
      }
    }

    return Object.values(storeMap).map(({ store, configs: zoneConfigs }) => {
      const zones: Record<string, any> = {};
      for (const zone of Object.values(PricingZone)) {
        const statuses: Record<string, any> = {};
        for (const status of Object.values(ReturnStatus)) {
          const config = zoneConfigs[zone]?.[status];
          if (config) {
            statuses[status] = {
              id: config.id,
              return_delivery_charge: Number(config.return_delivery_charge),
              return_weight_charge_per_kg: Number(
                config.return_weight_charge_per_kg,
              ),
              return_cod_percentage: Number(config.return_cod_percentage),
              discount_percentage: config.discount_percentage
                ? Number(config.discount_percentage)
                : 0,
              start_date: config.start_date,
              end_date: config.end_date,
              created_at: config.created_at,
              updated_at: config.updated_at,
            };
          } else {
            statuses[status] = {
              id: null,
              return_delivery_charge: 0,
              return_weight_charge_per_kg: 0,
              return_cod_percentage: 0,
              discount_percentage: 0,
              start_date: null,
              end_date: null,
              created_at: null,
              updated_at: null,
            };
          }
        }
        zones[zone] = statuses;
      }
      return {
        store_id: store.id,
        store,
        zones,
      };
    });
  }

  /**
   * Get single return charge configuration
   */
  async findOneReturnCharge(id: string): Promise<ReturnChargeConfiguration> {
    const config = await this.returnChargeRepository.findOne({
      where: { id },
      relations: ['store'],
    });

    if (!config) {
      throw new NotFoundException(
        `Return charge configuration with ID ${id} not found`,
      );
    }

    return config;
  }

  /**
   * Update return charge configuration
   */
  async updateReturnCharge(
    id: string,
    updateDto: UpdateReturnChargeConfigDto,
  ): Promise<ReturnChargeConfiguration> {
    const config = await this.findOneReturnCharge(id);

    Object.assign(config, updateDto);

    const updated = await this.returnChargeRepository.save(config);

    console.log(
      `[RETURN CHARGE UPDATED] ID: ${id}, Status: ${updated.return_status}, Zone: ${updated.zone}`,
    );

    return updated;
  }

  /**
   * Delete return charge configuration
   */
  async deleteReturnCharge(id: string): Promise<void> {
    const config = await this.findOneReturnCharge(id);
    await this.returnChargeRepository.remove(config);

    console.log(`[RETURN CHARGE DELETED] ID: ${id}`);
  }

  // ===== WEIGHT CHARGE CALCULATION METHODS =====

  /**
   * Calculate weight charge based on zone-specific rules
   *
   * FIXED VALUES:
   * - free_weight_kg = 0.5 kg (always free)
   * - charge_per_step = 10 BDT (INSIDE_DHAKA) or 20 BDT (SUB_DHAKA, OUTSIDE_DHAKA)
   *
   * CONFIGURABLE (from PricingConfiguration):
   * - weight_step_kg (step size)
   *
   * ALGORITHM:
   * 1. Subtract 0.5 kg from parcel weight
   * 2. If remaining weight <= 0, charge = 0
   * 3. Divide remaining weight by zone's weight step
   * 4. Round UP to nearest whole number (any fraction = 1 step)
   * 5. Multiply by zone's fixed per-step charge
   *
   * @param storeId - Store ID to lookup weight_step_kg config
   * @param zone - Pricing zone (determines charge_per_step)
   * @param weightKg - Parcel weight in kg
   * @returns Weight charge calculation result with breakdown
   */
  async calculateWeightCharge(
    storeId: string | null,
    zone: PricingZone,
    weightKg: number,
  ): Promise<WeightChargeCalculationResult> {
    // FIXED values
    const freeWeightKg = FIXED_FREE_WEIGHT_KG; // Always 0.5 kg
    const chargePerStep = FIXED_CHARGE_PER_STEP[zone]; // 10 or 20 based on zone

    // Get configurable weight step from store config or global default.
    const globalDefaults = await this.getPricingDefaults(zone);
    const defaults = globalDefaults.delivery_charges[zone];
    let weightStepKg = Number(defaults.weight_step_kg);

    // Try to get store-specific weight_step_kg
    if (storeId) {
      const config = await this.getActivePricing(storeId, zone);
      if (config) {
        weightStepKg = Number(config.weight_step_kg) || weightStepKg;
      }
    }

    // Step 1: Calculate billable weight (subtract free weight)
    const billableWeight = Math.max(0, weightKg - freeWeightKg);

    // Step 2-4: If billable weight <= 0, charge = 0
    let totalSteps = 0;
    let weightCharge = 0;

    if (billableWeight > 0) {
      // Step 3: Divide by weight step and round UP
      totalSteps = Math.ceil(billableWeight / weightStepKg);
      // Step 5: Multiply by per-step charge
      weightCharge = totalSteps * chargePerStep;
    }

    // Build human-readable breakdown
    const breakdown = this.buildWeightChargeBreakdown(
      zone,
      weightKg,
      freeWeightKg,
      billableWeight,
      weightStepKg,
      chargePerStep,
      totalSteps,
      weightCharge,
    );

    this.logger.log(
      `[WEIGHT CHARGE] Zone: ${zone}, Weight: ${weightKg}kg, Billable: ${billableWeight}kg, ` +
        `Steps: ${totalSteps}, Charge: ${weightCharge} BDT`,
    );

    return {
      zone,
      parcel_weight_kg: weightKg,
      free_weight_kg: freeWeightKg,
      billable_weight_kg: billableWeight,
      weight_step_kg: weightStepKg,
      charge_per_step: chargePerStep,
      total_steps: totalSteps,
      weight_charge: weightCharge,
      breakdown,
    };
  }

  /**
   * Build human-readable breakdown string for weight charge calculation
   */
  private buildWeightChargeBreakdown(
    zone: PricingZone,
    parcelWeight: number,
    freeWeight: number,
    billableWeight: number,
    stepSize: number,
    chargePerStep: number,
    steps: number,
    totalCharge: number,
  ): string {
    if (billableWeight <= 0) {
      return `Parcel weight (${parcelWeight}kg) is within free weight limit (${freeWeight}kg). No weight charge.`;
    }

    const zoneNames: Record<PricingZone, string> = {
      [PricingZone.INSIDE_DHAKA]: 'Inside Dhaka',
      [PricingZone.SUB_DHAKA]: 'Sub-Dhaka',
      [PricingZone.OUTSIDE_DHAKA]: 'Outside Dhaka',
    };

    return (
      `Zone: ${zoneNames[zone]}\n` +
      `Parcel weight: ${parcelWeight}kg\n` +
      `Free weight: ${freeWeight}kg (first ${freeWeight}kg is free)\n` +
      `Billable weight: ${billableWeight}kg (${parcelWeight} - ${freeWeight})\n` +
      `Weight step: ${stepSize}kg per step\n` +
      `Charge per step: ৳${chargePerStep}\n` +
      `Total steps: ${steps} (${billableWeight}kg ÷ ${stepSize}kg, rounded up)\n` +
      `Weight charge: ৳${totalCharge} (${steps} steps × ৳${chargePerStep})`
    );
  }

  /**
   * Get default/fixed pricing values for a zone (without database lookup)
   * Used when no configuration exists
   *
   * Returns both configurable defaults and fixed values
   */
  getDefaultPricingValues(zone: PricingZone): {
    delivery_charge: number;
    weight_step_kg: number;
    cod_percentage: number;
    discount_percentage: number;
    // Fixed values (not configurable)
    free_weight_kg: number;
    charge_per_step: number;
  } {
    const defaults = DEFAULT_PRICING_CONFIGS[zone];
    return {
      delivery_charge: defaults.delivery_charge,
      weight_step_kg: defaults.weight_step_kg,
      cod_percentage: defaults.cod_percentage,
      discount_percentage: defaults.discount_percentage,
      // Fixed values
      free_weight_kg: FIXED_FREE_WEIGHT_KG,
      charge_per_step: FIXED_CHARGE_PER_STEP[zone],
    };
  }
}
