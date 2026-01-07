import { Controller, Get, Query, Param, Post, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { CoverageAreasService } from './coverage-areas.service';
import { SearchCoverageAreaDto } from './dto/search-coverage-area.dto';
import { SuggestCoverageAreaDto } from './dto/suggest-coverage-area.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('coverage')
export class CoverageAreasController {
  constructor(private readonly coverageAreasService: CoverageAreasService) {}

  /**
   * Sync coverage areas from Carrybee API (Admin only)
   * Fetches cities, zones, and areas from Carrybee and populates coverage_areas table
   */
  @Post('sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async syncCoverageAreas() {
    const result = await this.coverageAreasService.syncCoverageAreasFromCarrybee();
    return {
      success: true,
      message: 'Coverage areas synced successfully from Carrybee',
      data: result,
    };
  }

  @Public()
  @Get('search')
  search(@Query() searchDto: SearchCoverageAreaDto) {
    return this.coverageAreasService.search(searchDto);
  }

  /**
   * Autocomplete/Suggest endpoint - searches across all fields with a single query
   * Usage: GET /coverage/suggest?q=Gul&limit=20
   * Returns suggestions matching division, city, zone, or area
   */
  @Public()
  @Get('suggest')
  suggest(@Query() suggestDto: SuggestCoverageAreaDto) {
    return this.coverageAreasService.suggest(suggestDto);
  }

  @Public()
  @Get('divisions')
  async getDivisions() {
    const divisions = await this.coverageAreasService.getDivisions();
    return { divisions };
  }

  @Public()
  @Get('divisions/:division/cities')
  async getCitiesByDivision(@Param('division') division: string) {
    const cities = await this.coverageAreasService.getCitiesByDivision(division);
    return { cities };
  }

  @Public()
  @Get('cities/:cityId/zones')
  async getZonesByCity(@Param('cityId') cityId: string) {
    const zones = await this.coverageAreasService.getZonesByCity(parseInt(cityId));
    return { zones };
  }

  @Public()
  @Get('zones/:zoneId/areas')
  async getAreasByZone(@Param('zoneId') zoneId: string) {
    const areas = await this.coverageAreasService.getAreasByZone(parseInt(zoneId));
    return { areas };
  }

  @Public()
  @Get(':id')
  async getById(@Param('id') id: string) {
    const coverageArea = await this.coverageAreasService.findById(id);
    return coverageArea;
  }
}
