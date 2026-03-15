import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { PricingService } from './pricing.service';
import { CreatePricingConfigurationDto } from './dto/create-pricing-configuration.dto';
import { UpdatePricingConfigurationDto } from './dto/update-pricing-configuration.dto';
import { CreateReturnChargeConfigDto } from './dto/create-return-charge-config.dto';
import { UpdateReturnChargeConfigDto } from './dto/update-return-charge-config.dto';
import { BulkCreateReturnChargesDto } from './dto/bulk-create-return-charges.dto';
import { CalculateWeightChargeDto } from './dto/calculate-weight-charge.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { PricingZone } from '../common/enums/pricing-zone.enum';

@Controller('pricing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  // ===== PRICING CONFIGURATION ENDPOINTS =====

  /**
   * Create pricing configuration for a store + zone
   */
  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() createPricingConfigurationDto: CreatePricingConfigurationDto) {
    const pricing = await this.pricingService.create(createPricingConfigurationDto);
    return {
      id: pricing.id,
      message: 'Pricing configuration created successfully',
    };
  }

  /**
   * Get all pricing configurations (admin only)
   */
  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.pricingService.findAll();
  }

  /**
   * Get default pricing values for all zones (no database lookup)
   */
  @Get('defaults')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  getDefaultPricingValues(@Query('zone') zone?: PricingZone) {
    if (zone) {
      return {
        zone,
        config: this.pricingService.getDefaultPricingValues(zone),
      };
    }

    return {
      [PricingZone.INSIDE_DHAKA]: this.pricingService.getDefaultPricingValues(PricingZone.INSIDE_DHAKA),
      [PricingZone.SUB_DHAKA]: this.pricingService.getDefaultPricingValues(PricingZone.SUB_DHAKA),
      [PricingZone.OUTSIDE_DHAKA]: this.pricingService.getDefaultPricingValues(PricingZone.OUTSIDE_DHAKA),
    };
  }

  /**
   * Get pricing configurations for a store
   */
  @Get('store/:storeId')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  findAllForStore(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.pricingService.findAllForStore(storeId);
  }

  // ===== WEIGHT CHARGE CALCULATION =====

  /**
   * Calculate weight charge for a parcel
   */
  @Post('calculate-weight-charge')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.HUB_MANAGER)
  async calculateWeightCharge(@Body() dto: CalculateWeightChargeDto) {
    const result = await this.pricingService.calculateWeightCharge(
      dto.store_id || null,
      dto.zone,
      dto.weight_kg,
    );
    return {
      weight_charge: result.weight_charge,
    };
  }

  // ===== RETURN CHARGE ENDPOINTS =====
  // These MUST be declared before the :id wildcard routes

  /**
   * Create return charge configuration for a specific status
   */
  @Post('return-charges')
  @Roles(UserRole.ADMIN)
  createReturnCharge(@Body() dto: CreateReturnChargeConfigDto) {
    return this.pricingService.createReturnCharge(dto);
  }

  /**
   * Bulk create return charges for all statuses at once
   */
  @Post('return-charges/bulk')
  @Roles(UserRole.ADMIN)
  bulkCreateReturnCharges(@Body() dto: BulkCreateReturnChargesDto) {
    return this.pricingService.bulkCreateReturnCharges(dto);
  }

  /**
   * Get all return charge configurations (admin only)
   */
  @Get('return-charges')
  @Roles(UserRole.ADMIN)
  findAllReturnCharges() {
    return this.pricingService.findAllReturnCharges();
  }

  /**
   * Get return charge configurations for a store
   */
  @Get('return-charges/store/:storeId')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  getReturnChargesForStore(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.pricingService.getReturnChargesForStore(storeId);
  }

  /**
   * Get single return charge configuration
   */
  @Get('return-charges/:id')
  @Roles(UserRole.ADMIN)
  findOneReturnCharge(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricingService.findOneReturnCharge(id);
  }

  /**
   * Update return charge configuration
   */
  @Patch('return-charges/:id')
  @Roles(UserRole.ADMIN)
  updateReturnCharge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReturnChargeConfigDto,
  ) {
    return this.pricingService.updateReturnCharge(id, dto);
  }

  /**
   * Delete return charge configuration
   */
  @Delete('return-charges/:id')
  @Roles(UserRole.ADMIN)
  deleteReturnCharge(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricingService.deleteReturnCharge(id);
  }

  // ===== WILDCARD :id ROUTES (must be last) =====

  /**
   * Get single pricing configuration
   */
  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricingService.findOne(id);
  }

  /**
   * Update pricing configuration
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePricingConfigurationDto: UpdatePricingConfigurationDto,
  ) {
    await this.pricingService.update(id, updatePricingConfigurationDto);
    return {
      message: 'Pricing configuration updated successfully',
    };
  }

  /**
   * Delete pricing configuration
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.pricingService.remove(id);
    return {
      message: 'Pricing configuration deleted successfully',
    };
  }
}
