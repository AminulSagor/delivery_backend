import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricingConfiguration } from './entities/pricing-configuration.entity';
import { CreatePricingConfigurationDto } from './dto/create-pricing-configuration.dto';
import { UpdatePricingConfigurationDto } from './dto/update-pricing-configuration.dto';
import { PricingZone } from '../common/enums/pricing-zone.enum';
import { ReturnChargeConfiguration, ReturnStatus } from './entities/return-charge-configuration.entity';
import { CreateReturnChargeConfigDto } from './dto/create-return-charge-config.dto';
import { UpdateReturnChargeConfigDto } from './dto/update-return-charge-config.dto';
import { BulkCreateReturnChargesDto } from './dto/bulk-create-return-charges.dto';
import { WeightChargeCalculationResult } from './dto/calculate-weight-charge.dto';

/**
 * FIXED weight charge values per zone
 * These values are NOT configurable by admin
 */
const FIXED_FREE_WEIGHT_KG = 0.5; // First 0.5 kg is always FREE

const FIXED_CHARGE_PER_STEP: Record<PricingZone, number> = {
  [PricingZone.INSIDE_DHAKA]: 10,   // 10 BDT per step
  [PricingZone.SUB_DHAKA]: 20,      // 20 BDT per step
  [PricingZone.OUTSIDE_DHAKA]: 20,  // 20 BDT per step
};

/**
 * Default pricing configurations per zone
 * Admin can configure: delivery_charge, weight_step_kg, cod_percentage
 * Fixed values: free_weight_kg (0.5), charge_per_step (10/20)
 */
const DEFAULT_PRICING_CONFIGS: Record<PricingZone, { 
  delivery_charge: number;
  weight_step_kg: number; 
  cod_percentage: number;
}> = {
  [PricingZone.INSIDE_DHAKA]: {
    delivery_charge: 60,
    weight_step_kg: 0.5,
    cod_percentage: 1.0,
  },
  [PricingZone.SUB_DHAKA]: {
    delivery_charge: 80,
    weight_step_kg: 2.0,
    cod_percentage: 2.0,
  },
  [PricingZone.OUTSIDE_DHAKA]: {
    delivery_charge: 120,
    weight_step_kg: 1.0,
    cod_percentage: 2.5,
  },
};

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    @InjectRepository(PricingConfiguration)
    private pricingRepository: Repository<PricingConfiguration>,
    @InjectRepository(ReturnChargeConfiguration)
    private returnChargeRepository: Repository<ReturnChargeConfiguration>,
  ) {}

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
    // Check for duplicate (same store + zone)
    const existing = await this.pricingRepository.findOne({
      where: {
        store_id: createDto.store_id,
        zone: createDto.zone,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Pricing configuration already exists for this store and zone ${createDto.zone}. ` +
        `Use update endpoint to modify it.`,
      );
    }

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

  /**
   * Get all pricing configurations for a store
   */
  async findAllForStore(storeId: string): Promise<PricingConfiguration[]> {
    return await this.pricingRepository.find({
      where: { store_id: storeId },
      order: { zone: 'ASC', created_at: 'DESC' },
    });
  }

  /**
   * Get all pricing configurations (admin only)
   */
  async findAll(): Promise<PricingConfiguration[]> {
    return await this.pricingRepository.find({
      relations: ['store'],
      order: { created_at: 'DESC' },
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
      throw new NotFoundException(`Pricing configuration with ID ${id} not found`);
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
    const config = this.returnChargeRepository.create(dto);
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
    const configs: ReturnChargeConfiguration[] = [];

    for (const statusCharge of dto.status_charges) {
      // Skip if all charges are 0 or undefined
      const hasCharges = 
        (statusCharge.return_delivery_charge > 0) ||
        (statusCharge.return_weight_charge_per_kg > 0) ||
        (statusCharge.return_cod_percentage && statusCharge.return_cod_percentage > 0);

      if (!hasCharges) {
        console.log(
          `[RETURN CHARGE] Skipping ${statusCharge.return_status} - no charges configured`,
        );
        continue;
      }

      const config = this.returnChargeRepository.create({
        store_id: dto.store_id,
        zone: dto.zone,
        return_status: statusCharge.return_status,
        return_delivery_charge: statusCharge.return_delivery_charge || 0,
        return_weight_charge_per_kg: statusCharge.return_weight_charge_per_kg || 0,
        return_cod_percentage: statusCharge.return_cod_percentage || 0,
        discount_percentage: statusCharge.discount_percentage || null,
        start_date: dto.start_date ? new Date(dto.start_date) : null,
        end_date: dto.end_date ? new Date(dto.end_date) : null,
      });

      configs.push(config);
    }

    const saved = await this.returnChargeRepository.save(configs);

    console.log(
      `[RETURN CHARGES BULK CREATED] Store: ${dto.store_id}, Zone: ${dto.zone}, Count: ${saved.length}`,
    );

    return saved;
  }

  /**
   * Get all return charge configs for a store
   */
  async getReturnChargesForStore(storeId: string): Promise<ReturnChargeConfiguration[]> {
    return await this.returnChargeRepository.find({
      where: { store_id: storeId },
      order: { zone: 'ASC', return_status: 'ASC' },
    });
  }

  /**
   * Get all return charge configurations (admin only)
   */
  async findAllReturnCharges(): Promise<ReturnChargeConfiguration[]> {
    return await this.returnChargeRepository.find({
      relations: ['store'],
      order: { created_at: 'DESC' },
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
      throw new NotFoundException(`Return charge configuration with ID ${id} not found`);
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

    // Get configurable weight step from store config or use default
    const defaults = DEFAULT_PRICING_CONFIGS[zone];
    let weightStepKg = defaults.weight_step_kg;

    // Try to get store-specific weight_step_kg
    if (storeId) {
      const config = await this.getActivePricing(storeId, zone);
      if (config) {
        weightStepKg = Number(config.weight_step_kg) || defaults.weight_step_kg;
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
    // Fixed values (not configurable)
    free_weight_kg: number;
    charge_per_step: number;
  } {
    const defaults = DEFAULT_PRICING_CONFIGS[zone];
    return {
      delivery_charge: defaults.delivery_charge,
      weight_step_kg: defaults.weight_step_kg,
      cod_percentage: defaults.cod_percentage,
      // Fixed values
      free_weight_kg: FIXED_FREE_WEIGHT_KG,
      charge_per_step: FIXED_CHARGE_PER_STEP[zone],
    };
  }
}
