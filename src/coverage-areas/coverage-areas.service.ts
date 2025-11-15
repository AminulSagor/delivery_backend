import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoverageArea } from './entities/coverage-area.entity';
import { SearchCoverageAreaDto } from './dto/search-coverage-area.dto';

@Injectable()
export class CoverageAreasService {
  constructor(
    @InjectRepository(CoverageArea)
    private coverageAreaRepository: Repository<CoverageArea>,
  ) {}

  async search(searchDto: SearchCoverageAreaDto): Promise<CoverageArea[]> {
    const query = this.coverageAreaRepository.createQueryBuilder('coverage');

    // Search by area (partial match - primary search)
    if (searchDto.area) {
      query.andWhere('LOWER(coverage.area) LIKE LOWER(:area)', {
        area: `%${searchDto.area}%`,
      });
    }

    // Filter by district
    if (searchDto.district) {
      query.andWhere('LOWER(coverage.district) LIKE LOWER(:district)', {
        district: `%${searchDto.district}%`,
      });
    }

    // Filter by division
    if (searchDto.division) {
      query.andWhere('LOWER(coverage.division) LIKE LOWER(:division)', {
        division: `%${searchDto.division}%`,
      });
    }

    // Filter by zone
    if (searchDto.zone) {
      query.andWhere('LOWER(coverage.zone) LIKE LOWER(:zone)', {
        zone: `%${searchDto.zone}%`,
      });
    }

    // Order by area name
    query.orderBy('coverage.area', 'ASC');

    // Limit results for performance
    query.limit(50);

    const results = await query.getMany();

    console.log(
      `[COVERAGE SEARCH] Found ${results.length} areas matching criteria`,
    );

    return results;
  }
}
