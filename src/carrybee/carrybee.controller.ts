import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CarrybeeService } from './carrybee.service';
import { CarrybeeWebhookService } from './carrybee-webhook.service';
import { SyncStoreToCarrybeeDto } from './dto/sync-store-to-carrybee.dto';
import { AssignToCarrybeeDto } from './dto/assign-to-carrybee.dto';
import { CarrybeeWebhookDto } from './dto/carrybee-webhook.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('carrybee')
export class CarrybeeController {
  constructor(
    private readonly carrybeeService: CarrybeeService,
    private readonly webhookService: CarrybeeWebhookService,
  ) {}

  // ===== LOCATION ENDPOINTS =====

  @Get('cities')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async getCities() {
    const cities = await this.carrybeeService.getCities();
    return {
      cities,
      message: 'Cities retrieved successfully',
    };
  }

  @Get('cities/:cityId/zones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async getZones(@Param('cityId') cityId: string) {
    const zones = await this.carrybeeService.getZones(parseInt(cityId));
    return {
      zones,
      message: 'Zones retrieved successfully',
    };
  }

  @Get('cities/:cityId/zones/:zoneId/areas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async getAreas(
    @Param('cityId') cityId: string,
    @Param('zoneId') zoneId: string,
  ) {
    const areas = await this.carrybeeService.getAreas(
      parseInt(cityId),
      parseInt(zoneId),
    );
    return {
      areas,
      message: 'Areas retrieved successfully',
    };
  }

  @Get('area-suggestion')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async searchArea(@Query('search') search: string) {
    const suggestions = await this.carrybeeService.searchArea(search);
    return {
      suggestions,
      message: 'Area suggestions retrieved successfully',
    };
  }

  // ===== STORE SYNC ENDPOINT =====

  @Post('stores/:storeId/sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async syncStoreToCarrybee(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: SyncStoreToCarrybeeDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.carrybeeService.syncStoreToCarrybee(
      storeId,
      dto,
      user.userId,
      user.role,
    );

    return {
      store_id: result.store_id,
      carrybee_store_id: result.carrybee_store_id,
      is_carrybee_synced: result.is_carrybee_synced,
      message: 'Store synced to Carrybee successfully',
    };
  }

  // ===== DEBUG ENDPOINTS =====

  @Get('stores')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async getCarrybeeStores() {
    const stores = await this.carrybeeService.getCarrybeeStores();
    return {
      stores,
      count: stores.length,
      message: 'Carrybee stores retrieved successfully',
    };
  }

  // ===== PARCEL ASSIGNMENT ENDPOINTS =====

  @Get('parcels/for-assignment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.HUB_MANAGER)
  async getParcelsForThirdPartyAssignment(@CurrentUser() user: any) {
    const parcels = await this.carrybeeService.getParcelsForThirdPartyAssignment(
      user.hubId,
    );

    return {
      parcels,
      message: 'Parcels retrieved successfully',
    };
  }

  @Post('parcels/:parcelId/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.HUB_MANAGER)
  async assignParcelToCarrybee(
    @Param('parcelId', ParseUUIDPipe) parcelId: string,
    @Body() dto: AssignToCarrybeeDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.carrybeeService.assignParcelToCarrybee(
      parcelId,
      dto,
      user.hubId,
    );

    return {
      parcel_id: result.parcel_id,
      carrybee_consignment_id: result.carrybee_consignment_id,
      delivery_fee: result.delivery_fee,
      cod_fee: result.cod_fee,
      message: 'Parcel assigned to Carrybee successfully',
    };
  }
}

// ===== WEBHOOK CONTROLLER (Separate, no auth) =====
@Controller('webhooks')
export class CarrybeeWebhookController {
  constructor(private readonly webhookService: CarrybeeWebhookService) {}

  @Post('carrybee')
  @HttpCode(HttpStatus.OK)
  async handleCarrybeeWebhook(
    @Body() payload: CarrybeeWebhookDto,
    @Headers('x-carrybee-webhook-signature') signature: string,
  ) {
    const result = await this.webhookService.handleWebhook(payload, signature);
    return result;
  }
}
