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
}
