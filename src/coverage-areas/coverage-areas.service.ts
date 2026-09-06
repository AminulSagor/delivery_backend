import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoverageArea } from './entities/coverage-area.entity';
import { SearchCoverageAreaDto } from './dto/search-coverage-area.dto';
import {
  SuggestAddressDto,
  SuggestCoverageAreaDto,
} from './dto/suggest-coverage-area.dto';
import { CarrybeeApiService } from '../carrybee/carrybee-api.service';

interface CoverageAreaWithNorms extends CoverageArea {
  _city_norm?: string;
  _zone_norm?: string;
  _area_norm?: string;
}
type MatchLevel = 'CITY' | 'ZONE' | 'AREA';

export interface AddressPrediction {
  division: string;
  city: string;
  city_id: number;

  zone: string | null;
  zone_id: number | null;

  area: string | null;
  area_id: number | null;
  coverage_area_uuid: string | null;

  inside_dhaka_flag: boolean;
  match_level: MatchLevel;
  confidence: number;
}

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
      Dhaka: 'Dhaka',
      Chattogram: 'Chattogram',
      Chittagong: 'Chattogram',
      Rajshahi: 'Rajshahi',
      Khulna: 'Khulna',
      Barishal: 'Barishal',
      Sylhet: 'Sylhet',
      Rangpur: 'Rangpur',
      Mymensingh: 'Mymensingh',
      Gazipur: 'Dhaka',
      Narayanganj: 'Dhaka',
      Cumilla: 'Chattogram',
      Comilla: 'Chattogram',
      "Cox's Bazar": 'Chattogram',
      Jessore: 'Khulna',
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
   * Test Carrybee API connection
   * Returns basic info about available cities to verify API is working
   */
  async testCarrybeeConnection(): Promise<{
    success: boolean;
    message: string;
    data?: any;
    error?: string;
  }> {
    try {
      this.logger.log('Testing Carrybee API connection...');
      const cities = await this.carrybeeApiService.getCities();

      if (!cities || cities.length === 0) {
        return {
          success: false,
          message: 'Carrybee API returned no cities',
          data: { cities_count: 0 },
        };
      }

      // Try to get zones for the first city
      const firstCity = cities[0];
      const zones = await this.carrybeeApiService.getZones(firstCity.id);

      return {
        success: true,
        message: 'Carrybee API connection successful',
        data: {
          cities_count: cities.length,
          sample_city: firstCity,
          sample_zones_count: zones?.length || 0,
        },
      };
    } catch (error) {
      this.logger.error('Carrybee API connection test failed', error.message);
      return {
        success: false,
        message: 'Failed to connect to Carrybee API',
        error: error.message,
      };
    }
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
    errors: string[];
  }> {
    this.logger.log('Starting coverage areas sync from Carrybee...');

    let totalSynced = 0;
    let citiesCount = 0;
    let zonesCount = 0;
    let areasCount = 0;
    const errors: string[] = [];

    try {
      // 1. Fetch all cities from Carrybee
      this.logger.log('Fetching cities from Carrybee API...');
      const cities = await this.carrybeeApiService.getCities();

      if (!cities || cities.length === 0) {
        const errorMsg = 'No cities returned from Carrybee API';
        this.logger.error(errorMsg);
        errors.push(errorMsg);
        return {
          synced: 0,
          cities: 0,
          zones: 0,
          areas: 0,
          errors,
        };
      }

      this.logger.log(`✅ Fetched ${cities.length} cities from Carrybee`);
      citiesCount = cities.length;

      for (const city of cities) {
        const division = this.getCityDivision(city.name);

        // Determine if city is in Dhaka
        const isDhaka =
          city.name.toLowerCase().includes('dhaka') ||
          city.name.toLowerCase().includes('gazipur') ||
          city.name.toLowerCase().includes('narayanganj');

        // 2. Fetch zones for this city
        try {
          const zones = await this.carrybeeApiService.getZones(city.id);
          this.logger.log(
            `Fetched ${zones.length} zones for city ${city.name}`,
          );
          zonesCount += zones.length;

          for (const zone of zones) {
            // 3. Fetch areas for this zone
            try {
              const areas = await this.carrybeeApiService.getAreas(
                city.id,
                zone.id,
              );

              if (!areas || areas.length === 0) {
                const warnMsg = `No areas found for zone ${zone.name} in ${city.name}`;
                this.logger.warn(warnMsg);
                continue;
              }

              this.logger.log(
                `Fetched ${areas.length} areas for zone ${zone.name} in ${city.name}`,
              );
              areasCount += areas.length;

              for (const area of areas) {
                try {
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
                    this.logger.log(
                      `✅ Synced ${totalSynced} coverage areas...`,
                    );
                  }
                } catch (dbError) {
                  const errMsg = `DB Error syncing area ${area.name}: ${dbError.message}`;
                  this.logger.error(errMsg);
                  errors.push(errMsg);
                }
              }
            } catch (error) {
              const errMsg = `Failed to fetch/sync areas for zone ${zone.id} (${zone.name}): ${error.message}`;
              this.logger.error(errMsg);
              errors.push(errMsg);
            }
          }
        } catch (error) {
          const errMsg = `Failed to fetch/sync zones for city ${city.id} (${city.name}): ${error.message}`;
          this.logger.error(errMsg);
          errors.push(errMsg);
        }
      }

      this.logger.log(
        `🎉 Sync completed! Synced ${totalSynced} coverage areas (${citiesCount} cities, ${zonesCount} zones, ${areasCount} areas). Errors: ${errors.length}`,
      );

      return {
        synced: totalSynced,
        cities: citiesCount,
        zones: zonesCount,
        areas: areasCount,
        errors,
      };
    } catch (error) {
      const errMsg = `Fatal error during sync: ${error.message}`;
      this.logger.error(errMsg);
      errors.push(errMsg);
      throw new Error(
        `Failed to sync coverage areas from Carrybee: ${error.message}`,
      );
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
  async getCitiesByDivision(
    division: string,
  ): Promise<Array<{ city: string; city_id: number }>> {
    const results = await this.coverageAreaRepository
      .createQueryBuilder('coverage')
      .select('coverage.city', 'city')
      .addSelect('coverage.city_id', 'city_id')
      .where('coverage.division = :division', { division })
      .distinct(true)
      .orderBy('coverage.city', 'ASC')
      .getRawMany();

    return results;
  }

  async getAllCities(): Promise<Array<{ city: string; city_id: number }>> {
    const results = await this.coverageAreaRepository
      .createQueryBuilder('coverage')
      .select('coverage.city', 'city')
      .addSelect('coverage.city_id', 'city_id')
      .distinct(true) // ✅ Correct usage
      .orderBy('coverage.city', 'ASC')
      .getRawMany();

    return results;
  }

  /**
   * Get zones by city
   */
  async getZonesByCity(
    cityId: number,
  ): Promise<Array<{ zone: string; zone_id: number }>> {
    const results = await this.coverageAreaRepository
      .createQueryBuilder('coverage')
      .select('coverage.zone', 'zone')
      .addSelect('coverage.zone_id', 'zone_id')
      .where('coverage.city_id = :cityId', { cityId })
      .distinct(true)
      .orderBy('coverage.zone', 'ASC')
      .getRawMany();

    return results;
  }

  /**
   * Get areas by zone
   */
  async getAreasByZone(
    zoneId: number,
  ): Promise<Array<{ area: string; area_id: number; id: string }>> {
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

  /**
   * Main API method: Suggests the best matching coverage area for a raw address string.
   */

  async suggestArea(
    input: SuggestAddressDto,
  ): Promise<AddressPrediction | null> {
    const allAreas = await this.coverageAreaRepository.find();
    const normalizedAreas: CoverageAreaWithNorms[] = allAreas.map((row) => ({
      ...row,
      _city_norm: this.normalizeText(row.city),
      _zone_norm: this.normalizeText(row.zone),
      _area_norm: this.normalizeText(row.area),
    }));

    return this.resolveAddressSuggestion(input, normalizedAreas);
  }

  /**
   * Bulk equivalent of suggestArea. Coverage data is loaded and normalized once,
   * while every item still uses the exact same single-address decision logic.
   */
  async suggestAreas(
    inputs: SuggestAddressDto[],
  ): Promise<Array<AddressPrediction | null>> {
    if (inputs.length === 0) return [];

    const allAreas = await this.coverageAreaRepository.find();
    const normalizedAreas: CoverageAreaWithNorms[] = allAreas.map((row) => ({
      ...row,
      _city_norm: this.normalizeText(row.city),
      _zone_norm: this.normalizeText(row.zone),
      _area_norm: this.normalizeText(row.area),
    }));

    return inputs.map((input) =>
      this.resolveAddressSuggestion(input, normalizedAreas),
    );
  }

  private resolveAddressSuggestion(
    input: SuggestAddressDto,
    normalizedAreas: CoverageAreaWithNorms[],
  ): AddressPrediction | null {
    // Always test the original customer address.
    const rawPrediction = this.findBestCoveragePrediction(
      input.address,
      normalizedAreas,
    );

    // Test Barikoi's corrected text separately.
    const fixedPrediction = input.fixedAddress?.trim()
      ? this.findBestCoveragePrediction(input.fixedAddress, normalizedAreas)
      : null;

    let prediction = this.pickBetterPrediction(rawPrediction, fixedPrediction);

    const barikoiReliable =
      Boolean(input.fixedAddress?.trim()) &&
      input.addressStatus?.toLowerCase() !== 'incomplete' &&
      (input.confidence ?? 0) >= 60 &&
      (input.barikoiScore ?? 0) > 0;

    // Use Barikoi's structured fields only when the response is reliable.
    if (barikoiReliable) {
      const structuredText = [
        input.fixedAddress,
        input.subArea,
        input.area,
        input.thana,
        input.city,
      ]
        .filter((value): value is string => Boolean(value?.trim()))
        .join(', ');

      const structuredPrediction = this.findBestCoveragePrediction(
        structuredText,
        normalizedAreas,
      );

      prediction = this.pickBetterPrediction(prediction, structuredPrediction);
    }

    return prediction;
  }

  // ===========================================================================
  // PRIVATE HELPER METHODS
  // ===========================================================================

  private buildAddressSearchText(input: SuggestAddressDto): string {
    /*
     * The matching algorithm checks comma-separated segments
     * from right to left.
     *
     * Therefore:
     * city is last,
     * sub-area is checked before area,
     * area is checked before thana.
     */
    const segments = [
      input.address,
      input.fixedAddress,
      input.thana,
      input.area,
      input.subArea,
      input.city,
    ];

    const normalizedSegments = new Set<string>();

    return segments
      .map((segment) => segment?.trim())
      .filter((segment): segment is string => Boolean(segment))
      .filter((segment) => {
        const normalized = this.normalizeText(segment);

        if (!normalized || normalizedSegments.has(normalized)) {
          return false;
        }

        normalizedSegments.add(normalized);
        return true;
      })
      .join(', ');
  }

  private findBestCoveragePrediction(
    rawAddress: string,
    coverageAreas: CoverageAreaWithNorms[],
  ): AddressPrediction | null {
    const addressNorm = this.normalizeText(rawAddress);

    if (!addressNorm) {
      return null;
    }

    // ---------------------------------------------------------
    // 1. Find the city
    // ---------------------------------------------------------

    const cityGroups = new Map<number, CoverageAreaWithNorms[]>();

    for (const row of coverageAreas) {
      const rows = cityGroups.get(row.city_id) ?? [];
      rows.push(row);
      cityGroups.set(row.city_id, rows);
    }

    let bestCityRows: CoverageAreaWithNorms[] | null = null;
    let bestCityScore = 0;

    for (const rows of cityGroups.values()) {
      const cityScore = this.scoreLocationName(
        addressNorm,
        rows[0]._city_norm ?? '',
      );

      if (cityScore > bestCityScore) {
        bestCityScore = cityScore;
        bestCityRows = rows;
      }
    }

    // Use the matched city when reliable. Otherwise, zone matching may
    // still identify the city.
    const cityCandidates =
      bestCityRows && bestCityScore >= 0.72 ? bestCityRows : coverageAreas;

    // ---------------------------------------------------------
    // 2. Find zones first
    // ---------------------------------------------------------

    const zoneGroups = new Map<string, CoverageAreaWithNorms[]>();

    for (const row of cityCandidates) {
      const key = `${row.city_id}:${row.zone_id}`;
      const rows = zoneGroups.get(key) ?? [];
      rows.push(row);
      zoneGroups.set(key, rows);
    }

    const rankedZones: Array<{
      rows: CoverageAreaWithNorms[];
      zoneScore: number;
      areaMatch: {
        row: CoverageAreaWithNorms;
        score: number;
      } | null;
      totalScore: number;
    }> = [];

    for (const rows of zoneGroups.values()) {
      const representative = rows[0];

      const fullZone = representative._zone_norm ?? '';
      const baseZone = this.getZoneBase(representative.zone);

      const zoneScore = Math.max(
        this.scoreLocationName(addressNorm, fullZone),
        this.scoreLocationName(addressNorm, baseZone),
      );

      // Important: an area such as "Block A" cannot select a zone
      // when the zone itself did not match.
      if (zoneScore < 0.55) {
        continue;
      }

      const areaMatch = this.findBestAreaInsideZone(
        addressNorm,
        rows,
        baseZone,
      );

      const strongAreaScore =
        areaMatch && areaMatch.score >= 0.76 ? areaMatch.score : 0;

      rankedZones.push({
        rows,
        zoneScore,
        areaMatch,
        totalScore: zoneScore * 0.72 + strongAreaScore * 0.28,
      });
    }

    rankedZones.sort((a, b) => b.totalScore - a.totalScore);

    const bestZone = rankedZones[0];
    const secondZone = rankedZones[1];

    if (bestZone) {
      const bestRow = bestZone.rows[0];

      const zoneIsDistinct =
        !secondZone ||
        bestZone.totalScore - secondZone.totalScore >= 0.05 ||
        (bestZone.areaMatch?.score ?? 0) - (secondZone.areaMatch?.score ?? 0) >=
          0.15;

      if (zoneIsDistinct) {
        const areaMatch =
          bestZone.areaMatch && bestZone.areaMatch.score >= 0.76
            ? bestZone.areaMatch
            : null;

        return {
          division: bestRow.division,
          city: bestRow.city,
          city_id: bestRow.city_id,

          zone: bestRow.zone,
          zone_id: bestRow.zone_id,

          area: areaMatch?.row.area ?? null,
          area_id: areaMatch?.row.area_id ?? null,
          coverage_area_uuid: areaMatch?.row.id ?? null,

          inside_dhaka_flag: bestRow.inside_dhaka_flag,
          match_level: areaMatch ? 'AREA' : 'ZONE',
          confidence: Number(
            (areaMatch?.score ?? bestZone.zoneScore).toFixed(3),
          ),
        };
      }
    }

    // ---------------------------------------------------------
    // 3. City-only fallback
    // ---------------------------------------------------------

    if (bestCityRows && bestCityScore >= 0.72) {
      const row = bestCityRows[0];

      return {
        division: row.division,
        city: row.city,
        city_id: row.city_id,

        zone: null,
        zone_id: null,

        area: null,
        area_id: null,
        coverage_area_uuid: null,

        inside_dhaka_flag: row.inside_dhaka_flag,
        match_level: 'CITY',
        confidence: Number(bestCityScore.toFixed(3)),
      };
    }

    return null;
  }

  private findBestAreaInsideZone(
    addressNorm: string,
    zoneRows: CoverageAreaWithNorms[],
    baseZone: string,
  ): {
    row: CoverageAreaWithNorms;
    score: number;
  } | null {
    let best: {
      row: CoverageAreaWithNorms;
      score: number;
    } | null = null;

    const baseZoneTokens = new Set(this.tokenizeAddress(baseZone));

    for (const row of zoneRows) {
      const areaNorm = row._area_norm ?? '';

      if (!areaNorm) {
        continue;
      }

      let score = this.scoreLocationName(addressNorm, areaNorm);

      const areaTokens = this.tokenizeAddress(areaNorm);

      // Prevent an area that simply repeats the zone from winning.
      // Example:
      // Zone: Uttara Sector 4
      // Area: Sector 4
      const repeatsZone =
        areaTokens.length > 0 &&
        areaTokens.every((token) => baseZoneTokens.has(token));

      if (repeatsZone) {
        score *= 0.55;
      }

      if (!best || score > best.score) {
        best = { row, score };
      }
    }

    return best;
  }

  private getZoneBase(zone: string): string {
    // Banasree (Block A-G) becomes Banasree.
    const withoutDetails = zone.split('(')[0];

    return this.normalizeText(withoutDetails);
  }

  private scoreLocationName(
    addressNorm: string,
    candidateNorm: string,
  ): number {
    if (!addressNorm || !candidateNorm) {
      return 0;
    }

    const addressWithSpaces = ` ${addressNorm} `;
    const candidateWithSpaces = ` ${candidateNorm} `;

    // Exact phrase is strongest.
    if (addressWithSpaces.includes(candidateWithSpaces)) {
      return 1;
    }

    const addressTokens = this.tokenizeAddress(addressNorm);
    const candidateTokens = this.tokenizeAddress(candidateNorm);

    if (candidateTokens.length === 0) {
      return 0;
    }

    const addressTokenSet = new Set(addressTokens);

    // Reject number conflicts.
    // "Sector 3" must not match an address containing "Sector 4".
    const candidateNumbers = candidateTokens.filter((token) =>
      /^\d+[a-z]?$/.test(token),
    );

    if (candidateNumbers.some((number) => !addressTokenSet.has(number))) {
      return 0;
    }

    let matchedScore = 0;

    for (const candidateToken of candidateTokens) {
      if (addressTokenSet.has(candidateToken)) {
        matchedScore += 1;
        continue;
      }

      let bestSimilarity = 0;

      for (const addressToken of addressTokens) {
        bestSimilarity = Math.max(
          bestSimilarity,
          this.similarity(candidateToken, addressToken),
        );
      }

      if (bestSimilarity >= 0.86) {
        matchedScore += 0.75;
      }
    }

    const coverage = matchedScore / candidateTokens.length;

    // Do not accept a weak partial match.
    if (candidateTokens.length === 1) {
      return coverage >= 0.75 ? coverage : 0;
    }

    return coverage >= 0.6 ? coverage * 0.9 : 0;
  }

  private pickBetterPrediction(
    first: AddressPrediction | null,
    second: AddressPrediction | null,
  ): AddressPrediction | null {
    if (!first) return second;
    if (!second) return first;

    // Raw and Barikoi disagree about city: keep the first result.
    if (first.city_id && second.city_id && first.city_id !== second.city_id) {
      return first;
    }

    // Raw already found a zone and Barikoi found another zone:
    // do not allow Barikoi to overwrite it.
    if (first.zone_id && second.zone_id && first.zone_id !== second.zone_id) {
      return first;
    }

    const rank: Record<MatchLevel, number> = {
      CITY: 1,
      ZONE: 2,
      AREA: 3,
    };

    if (rank[second.match_level] > rank[first.match_level]) {
      return second;
    }

    if (
      rank[second.match_level] === rank[first.match_level] &&
      second.confidence > first.confidence + 0.08
    ) {
      return second;
    }

    return first;
  }

  // --- TEXT NORMALIZATION HELPERS ---

  private normalizeText(input?: string | null): string {
    if (!input) return '';

    const banglaDigits: Record<string, string> = {
      '০': '0',
      '১': '1',
      '২': '2',
      '৩': '3',
      '৪': '4',
      '৫': '5',
      '৬': '6',
      '৭': '7',
      '৮': '8',
      '৯': '9',
    };

    let value = input
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[০-৯]/g, (digit) => banglaDigits[digit]);

    value = value
      // Known spelling variants
      .replace(/\bkarnaphuli\b/g, 'karnafuli')
      .replace(/\bchittagong\b/g, 'chattogram')
      .replace(/\bbashundhora\b/g, 'bashundhara')
      .replace(/\bbashundhra\b/g, 'bashundhara')
      .replace(/\bbasundhara\b/g, 'bashundhara')

      // Important location patterns
      .replace(/\broad\s*(?:no\.?|number)?\s*(\d+[a-z]?)\b/g, 'road $1')
      .replace(/\bsector\s*(?:no\.?|number)?\s*(\d+[a-z]?)\b/g, 'sector $1')
      .replace(/\bblock\s*(?:no\.?|number)?\s*([a-z0-9]+)\b/g, 'block $1')

      // Generic administrative words
      .replace(/\b(?:thana|upazila|police station)\b/g, ' ')
      .replace(/থানা/g, ' ')

      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return value;
  }

  private tokenizeAddress(input?: string | null): string[] {
    const normalized = this.normalizeText(input);

    if (!normalized) {
      return [];
    }

    const ignoredWords = new Set([
      'house',
      'holding',
      'flat',
      'floor',
      'no',
      'number',
      'বাসা',
      'বাড়ি',
      'ফ্ল্যাট',
    ]);

    return normalized
      .split(' ')
      .filter(Boolean)
      .filter(
        (token) =>
          token.length >= 2 ||
          /^\d+[a-z]?$/.test(token) ||
          /^[a-z]$/.test(token),
      )
      .filter((token) => !ignoredWords.has(token));
  }

  // --- SIMILARITY HELPERS ---

  private levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
    const cur = new Array(b.length + 1).fill(0);

    for (let i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(
          prev[j] + 1, // delete
          cur[j - 1] + 1, // insert
          prev[j - 1] + cost, // substitute
        );
      }
      for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
    }
    return prev[b.length];
  }

  private similarity(a: string, b: string): number {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    const dist = this.levenshtein(a, b);
    return 1 - dist / Math.max(a.length, b.length);
  }

  private jaccard(a: string[], b: string[]): number {
    if (!a.length || !b.length) return 0;
    const sa = new Set(a);
    const sb = new Set(b);
    let inter = 0;
    for (const t of sa) if (sb.has(t)) inter++;
    const union = sa.size + sb.size - inter;
    return union === 0 ? 0 : inter / union;
  }

  private scoreCoverageForAddress(
    addressTokens: string[],
    area: CoverageAreaWithNorms,
  ): number {
    const areaTokens = this.tokenizeAddress(area.area);
    const zoneTokens = this.tokenizeAddress(area.zone);
    const cityTokens = this.tokenizeAddress(area.city);

    return (
      3 * this.jaccard(addressTokens, areaTokens) +
      2 * this.jaccard(addressTokens, zoneTokens) +
      1 * this.jaccard(addressTokens, cityTokens)
    );
  }
}
