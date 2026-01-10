import {
  Controller,
  Get,
  Query,
  Param,
  Post,
  HttpCode,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { CoverageAreasService } from './coverage-areas.service';
import { SearchCoverageAreaDto } from './dto/search-coverage-area.dto';
import {
  SuggestAddressDto,
  SuggestCoverageAreaDto,
} from './dto/suggest-coverage-area.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('coverage')
export class CoverageAreasController {
  constructor(private readonly coverageAreasService: CoverageAreasService) {}

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

  // @Public()
  // @Post('address/suggest')
  // @HttpCode(HttpStatus.OK)
  // async suggestAddress(@Body() dto: SuggestAddressDto) {
  //   const suggestion = await this.coverageAreasService.suggestArea(dto.address);

  //   return {
  //     status: suggestion ? 'SUCCESS' : 'FAILED',
  //     suggested_area_id: suggestion?.area || null,
  //     suggested_city: suggestion?.city || null,
  //     suggested_zone: suggestion?.zone || null,
  //     // Optional: return debug info or confidence score if needed
  //   };
  // }

  @Public()
  @Post('address/suggest')
  @HttpCode(HttpStatus.OK)
  async suggestAddress(@Body() dto: SuggestAddressDto) {
    const suggestion = await this.coverageAreasService.suggestArea(dto.address);
    // suggestion should be: CoverageSuggestion | null

    return {
      status: suggestion ? 'SUCCESS' : 'FAILED',

      suggested_division: suggestion?.division ?? null,

      suggested_city: suggestion?.city ?? null,
      suggested_city_id: suggestion?.city_id ?? null,

      suggested_zone: suggestion?.zone ?? null,
      suggested_zone_id: suggestion?.zone_id ?? null,

      suggested_area: suggestion?.area ?? null,
      suggested_area_id: suggestion?.area_id ?? null,

      inside_dhaka_flag: suggestion?.inside_dhaka_flag ?? null,
    };
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
    const cities =
      await this.coverageAreasService.getCitiesByDivision(division);
    return { cities };
  }

  @Public()
  @Get('cities')
  async getAllCities() {
    const cities = await this.coverageAreasService.getAllCities();
    return {
      success: true,
      data: cities,
      message: 'All cities retrieved successfully',
    };
  }

  @Public()
  @Get('cities/:cityId/zones')
  async getZonesByCity(@Param('cityId') cityId: string) {
    const zones = await this.coverageAreasService.getZonesByCity(
      parseInt(cityId),
    );
    return { zones };
  }

  @Public()
  @Get('zones/:zoneId/areas')
  async getAreasByZone(@Param('zoneId') zoneId: string) {
    const areas = await this.coverageAreasService.getAreasByZone(
      parseInt(zoneId),
    );
    return { areas };
  }

  @Public()
  @Get(':id')
  async getById(@Param('id') id: string) {
    const coverageArea = await this.coverageAreasService.findById(id);
    return coverageArea;
  }
}
