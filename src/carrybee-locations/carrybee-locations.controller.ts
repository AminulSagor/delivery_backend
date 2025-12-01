import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CarrybeeLocationsService } from './carrybee-locations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('carrybee-locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CarrybeeLocationsController {
  constructor(private readonly locationsService: CarrybeeLocationsService) {}

  // Sync locations from Carrybee (Admin only)
  @Post('sync')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async syncLocations() {
    const result = await this.locationsService.syncLocationsFromCarrybee();
    return {
      message: 'Locations synced successfully',
      ...result,
    };
  }

  // Get all cities (Merchant, Admin)
  @Get('cities')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.HUB_MANAGER)
  async getCities() {
    const cities = await this.locationsService.getCities();
    return {
      cities,
      count: cities.length,
    };
  }

  // Get zones by city (Merchant, Admin)
  @Get('cities/:cityId/zones')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.HUB_MANAGER)
  async getZonesByCity(@Param('cityId', ParseIntPipe) cityId: number) {
    const zones = await this.locationsService.getZonesByCity(cityId);
    return {
      zones,
      count: zones.length,
    };
  }

  // Get areas by zone (Merchant, Admin)
  @Get('zones/:zoneId/areas')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.HUB_MANAGER)
  async getAreasByZone(@Param('zoneId', ParseIntPipe) zoneId: number) {
    const areas = await this.locationsService.getAreasByZone(zoneId);
    return {
      areas,
      count: areas.length,
    };
  }

  // Search locations (Merchant, Admin)
  @Get('search')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.HUB_MANAGER)
  async searchLocations(@Query('q') searchTerm: string) {
    if (!searchTerm || searchTerm.length < 2) {
      return {
        locations: [],
        message: 'Search term must be at least 2 characters',
      };
    }

    const locations = await this.locationsService.searchLocations(searchTerm);
    return {
      locations,
      count: locations.length,
    };
  }
}
