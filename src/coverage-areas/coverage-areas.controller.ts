import { Controller, Get, Query } from '@nestjs/common';
import { CoverageAreasService } from './coverage-areas.service';
import { SearchCoverageAreaDto } from './dto/search-coverage-area.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('coverage')
export class CoverageAreasController {
  constructor(private readonly coverageAreasService: CoverageAreasService) {}

  @Public()
  @Get('search')
  search(@Query() searchDto: SearchCoverageAreaDto) {
    return this.coverageAreasService.search(searchDto);
  }
}
