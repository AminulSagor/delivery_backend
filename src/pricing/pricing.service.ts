import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { PricingConfiguration } from './entities/pricing-configuration.entity';
import { CreatePricingConfigurationDto } from './dto/create-pricing-configuration.dto';
import { UpdatePricingConfigurationDto } from './dto/update-pricing-configuration.dto';
import { PricingZone } from '../common/enums/pricing-zone.enum';
import { ReturnChargeConfiguration, ReturnStatus } from './entities/return-charge-configuration.entity';
import { CreateReturnChargeConfigDto } from './dto/create-return-charge-config.dto';
import { UpdateReturnChargeConfigDto } from './dto/update-return-charge-config.dto';
import { BulkCreateReturnChargesDto } from './dto/bulk-create-return-charges.dto';

@Injectable()
export class PricingService {
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
   * Create new pricing configuration
   */
  async create(
    createDto: CreatePricingConfigurationDto,
  ): Promise<PricingConfiguration> {
    const pricing = this.pricingRepository.create(createDto);

    const saved = await this.pricingRepository.save(pricing);

    console.log(
      `[PRICING CREATED] Store: ${saved.store_id}, Zone: ${saved.zone}, Delivery: ${saved.delivery_charge} BDT, COD: ${saved.cod_percentage}%`,
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
      relations: ['store'],
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
}
