import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { PricingConfiguration } from './entities/pricing-configuration.entity';
import { CreatePricingConfigurationDto } from './dto/create-pricing-configuration.dto';
import { UpdatePricingConfigurationDto } from './dto/update-pricing-configuration.dto';
import { PricingZone } from '../common/enums/pricing-zone.enum';

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(PricingConfiguration)
    private pricingRepository: Repository<PricingConfiguration>,
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
}
