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

    // Filter by city
    if (searchDto.city) {
      query.andWhere('LOWER(coverage.city) LIKE LOWER(:city)', {
        city: `%${searchDto.city}%`,
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

  /**
   * Get coverage area by ID and return with Carrybee IDs
   */
  async findById(id: string): Promise<CoverageArea | null> {
    return this.coverageAreaRepository.findOne({ where: { id } });
  }

  /**
   * Get all divisions
   */
  async getDivisions(): Promise<string[]> {
    const results = await this.coverageAreaRepository
      .createQueryBuilder('coverage')
      .select('DISTINCT coverage.division', 'division')
      .orderBy('coverage.division', 'ASC')
      .getRawMany();

    return results.map((r) => r.division);
  }

  /**
   * Get cities by division
   */
  async getCitiesByDivision(division: string): Promise<Array<{ city: string; city_id: number }>> {
    const results = await this.coverageAreaRepository
      .createQueryBuilder('coverage')
      .select('DISTINCT coverage.city', 'city')
      .addSelect('coverage.city_id', 'city_id')
      .where('coverage.division = :division', { division })
      .orderBy('coverage.city', 'ASC')
      .getRawMany();

    return results;
  }

  /**
   * Get zones by city
   */
  async getZonesByCity(cityId: number): Promise<Array<{ zone: string; zone_id: number }>> {
    const results = await this.coverageAreaRepository
      .createQueryBuilder('coverage')
      .select('DISTINCT coverage.zone', 'zone')
      .addSelect('coverage.zone_id', 'zone_id')
      .where('coverage.city_id = :cityId', { cityId })
      .orderBy('coverage.zone', 'ASC')
      .getRawMany();

    return results;
  }

  /**
   * Get areas by zone
   */
  async getAreasByZone(zoneId: number): Promise<Array<{ area: string; area_id: number; id: string }>> {
    const results = await this.coverageAreaRepository
      .createQueryBuilder('coverage')
      .select('coverage.area', 'area')
      .addSelect('coverage.area_id', 'area_id')
      .addSelect('coverage.id', 'id')
      .where('coverage.zone_id = :zoneId', { zoneId })
      .orderBy('coverage.area', 'ASC')
      .getRawMany();

    return results;
  }
}
