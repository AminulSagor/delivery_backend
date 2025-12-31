import { Controller, Get, Query, Param } from '@nestjs/common';
import { CoverageAreasService } from './coverage-areas.service';
import { SearchCoverageAreaDto } from './dto/search-coverage-area.dto';
import { SuggestCoverageAreaDto } from './dto/suggest-coverage-area.dto';
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
