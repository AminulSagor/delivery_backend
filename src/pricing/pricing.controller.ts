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
} from '@nestjs/common';
import { PricingService } from './pricing.service';
import { CreatePricingConfigurationDto } from './dto/create-pricing-configuration.dto';
import { UpdatePricingConfigurationDto } from './dto/update-pricing-configuration.dto';
import { CreateReturnChargeConfigDto } from './dto/create-return-charge-config.dto';
import { UpdateReturnChargeConfigDto } from './dto/update-return-charge-config.dto';
import { BulkCreateReturnChargesDto } from './dto/bulk-create-return-charges.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('pricing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() createPricingConfigurationDto: CreatePricingConfigurationDto) {
    return this.pricingService.create(createPricingConfigurationDto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.pricingService.findAll();
  }

  @Get('store/:storeId')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  findAllForStore(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.pricingService.findAllForStore(storeId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricingService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePricingConfigurationDto: UpdatePricingConfigurationDto,
  ) {
    return this.pricingService.update(id, updatePricingConfigurationDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricingService.remove(id);
  }

  // ===== RETURN CHARGE ENDPOINTS =====

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
}
