import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoverageArea } from './entities/coverage-area.entity';
import { SearchCoverageAreaDto } from './dto/search-coverage-area.dto';
import { SuggestCoverageAreaDto } from './dto/suggest-coverage-area.dto';
import { CarrybeeApiService } from '../carrybee/carrybee-api.service';

@Injectable()
export class CoverageAreasService {
  private readonly logger = new Logger(CoverageAreasService.name);

  constructor(
    @InjectRepository(CoverageArea)
    private coverageAreaRepository: Repository<CoverageArea>,
    private readonly carrybeeApiService: CarrybeeApiService,
  ) {}

  /**
   * Map city names to their divisions
   * This is a simple mapping for Bangladesh's major cities
   */
  private getCityDivision(cityName: string): string {
    const divisionMap: Record<string, string> = {
      'Dhaka': 'Dhaka',
      'Chattogram': 'Chattogram',
      'Chittagong': 'Chattogram',
      'Rajshahi': 'Rajshahi',
      'Khulna': 'Khulna',
      'Barishal': 'Barishal',
      'Sylhet': 'Sylhet',
      'Rangpur': 'Rangpur',
      'Mymensingh': 'Mymensingh',
      'Gazipur': 'Dhaka',
      'Narayanganj': 'Dhaka',
      'Cumilla': 'Chattogram',
      'Comilla': 'Chattogram',
      'Cox\'s Bazar': 'Chattogram',
      'Jessore': 'Khulna',
    };

    // Check if city name contains any of the division keywords
    for (const [city, division] of Object.entries(divisionMap)) {
      if (cityName.toLowerCase().includes(city.toLowerCase())) {
        return division;
      }
    }

    // Default to the city name itself if no mapping found
    return cityName;
  }

  /**
   * Sync locations from Carrybee API to coverage_areas table
   * Similar to carrybee-locations sync but populates coverage_areas
   */
  async syncCoverageAreasFromCarrybee(): Promise<{
    synced: number;
    cities: number;
    zones: number;
    areas: number;
  }> {
    this.logger.log('Starting coverage areas sync from Carrybee...');

    let totalSynced = 0;
    let citiesCount = 0;
    let zonesCount = 0;
    let areasCount = 0;

    try {
      // 1. Fetch all cities from Carrybee
      const cities = await this.carrybeeApiService.getCities();
      this.logger.log(`Fetched ${cities.length} cities from Carrybee`);
      citiesCount = cities.length;

      for (const city of cities) {
        const division = this.getCityDivision(city.name);

        // Determine if city is in Dhaka
        const isDhaka = city.name.toLowerCase().includes('dhaka') || 
                        city.name.toLowerCase().includes('gazipur') ||
                        city.name.toLowerCase().includes('narayanganj');

        // 2. Fetch zones for this city
        try {
          const zones = await this.carrybeeApiService.getZones(city.id);
          this.logger.log(`Fetched ${zones.length} zones for city ${city.name}`);
          zonesCount += zones.length;

          for (const zone of zones) {
            // 3. Fetch areas for this zone
            try {
              const areas = await this.carrybeeApiService.getAreas(city.id, zone.id);
              this.logger.log(`Fetched ${areas.length} areas for zone ${zone.name} in ${city.name}`);
              areasCount += areas.length;

              for (const area of areas) {
                // Upsert into coverage_areas table
                await this.coverageAreaRepository.upsert(
                  {
                    division: division,
                    city: city.name,
                    city_id: city.id,
                    zone: zone.name,
                    zone_id: zone.id,
                    area: area.name,
                    area_id: area.id,
                    inside_dhaka_flag: isDhaka,
                  },
                  ['city_id', 'zone_id', 'area_id'], // Use these as conflict target
                );
                totalSynced++;

                // Log progress every 100 areas
                if (totalSynced % 100 === 0) {
                  this.logger.log(`Synced ${totalSynced} coverage areas...`);
                }
              }
            } catch (error) {
              this.logger.error(
                `Failed to fetch/sync areas for zone ${zone.id} (${zone.name})`,
                error.message,
              );
            }
          }
        } catch (error) {
          this.logger.error(
            `Failed to fetch/sync zones for city ${city.id} (${city.name})`,
            error.message,
          );
        }
      }

      this.logger.log(
        `Sync completed successfully! Synced ${totalSynced} coverage areas (${citiesCount} cities, ${zonesCount} zones, ${areasCount} areas)`,
      );

      return {
        synced: totalSynced,
        cities: citiesCount,
        zones: zonesCount,
        areas: areasCount,
      };
    } catch (error) {
      this.logger.error('Failed to sync coverage areas from Carrybee', error.message);
      throw error;
    }
  }

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

  /**
   * Validate location IDs exist in coverage_areas table
   */
  async validateLocationIds(
    cityId: number,
    zoneId: number,
    areaId: number,
  ): Promise<boolean> {
    const area = await this.coverageAreaRepository.findOne({
      where: {
        city_id: cityId,
        zone_id: zoneId,
        area_id: areaId,
      },
    });

    return !!area;
  }

  /**
   * Autocomplete/Suggest coverage areas by searching across all fields
   * Searches in division, city, zone, and area fields
   */
  async suggest(suggestDto: SuggestCoverageAreaDto): Promise<{
    suggestions: Array<{
      id: string;
      division: string;
      city: string;
      city_id: number;
      zone: string;
      zone_id: number;
      area: string;
      area_id: number;
      match_field: string;
      full_address: string;
    }>;
    total: number;
  }> {
    const { q, limit = 20 } = suggestDto;
    const searchTerm = q.toLowerCase().trim();

    const query = this.coverageAreaRepository.createQueryBuilder('coverage');

    // Search across all fields: division, city, zone, area
    query.where(
      `(
        LOWER(coverage.division) LIKE :searchTerm OR
        LOWER(coverage.city) LIKE :searchTerm OR
        LOWER(coverage.zone) LIKE :searchTerm OR
        LOWER(coverage.area) LIKE :searchTerm
      )`,
      { searchTerm: `%${searchTerm}%` },
    );

    // Order by relevance: exact matches first, then partial matches
    // Prioritize area matches, then zone, then city, then division
    query.orderBy(
      `CASE 
        WHEN LOWER(coverage.area) LIKE :exactStart THEN 1
        WHEN LOWER(coverage.zone) LIKE :exactStart THEN 2
        WHEN LOWER(coverage.city) LIKE :exactStart THEN 3
        WHEN LOWER(coverage.division) LIKE :exactStart THEN 4
        WHEN LOWER(coverage.area) LIKE :searchTerm THEN 5
        WHEN LOWER(coverage.zone) LIKE :searchTerm THEN 6
        WHEN LOWER(coverage.city) LIKE :searchTerm THEN 7
        ELSE 8
      END`,
      'ASC',
    );
    query.setParameter('exactStart', `${searchTerm}%`);
    query.setParameter('searchTerm', `%${searchTerm}%`);

    // Secondary sort by area name
    query.addOrderBy('coverage.area', 'ASC');

    // Limit results
    query.limit(limit);

    const results = await query.getMany();

    // Transform results to include match field info
    const suggestions = results.map((coverage) => {
      let match_field = 'area';
      const searchLower = searchTerm.toLowerCase();
      
      if (coverage.area.toLowerCase().includes(searchLower)) {
        match_field = 'area';
      } else if (coverage.zone.toLowerCase().includes(searchLower)) {
        match_field = 'zone';
      } else if (coverage.city.toLowerCase().includes(searchLower)) {
        match_field = 'city';
      } else if (coverage.division.toLowerCase().includes(searchLower)) {
        match_field = 'division';
      }

      return {
        id: coverage.id,
        division: coverage.division,
        city: coverage.city,
        city_id: coverage.city_id,
        zone: coverage.zone,
        zone_id: coverage.zone_id,
        area: coverage.area,
        area_id: coverage.area_id,
        match_field,
        full_address: `${coverage.area}, ${coverage.zone}, ${coverage.city}, ${coverage.division}`,
      };
    });

    console.log(
      `[COVERAGE SUGGEST] Found ${suggestions.length} suggestions for query "${q}"`,
    );

    return {
      suggestions,
      total: suggestions.length,
    };
  }
}
