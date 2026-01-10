import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoverageArea } from './entities/coverage-area.entity';
import { SearchCoverageAreaDto } from './dto/search-coverage-area.dto';
import { SuggestCoverageAreaDto } from './dto/suggest-coverage-area.dto';

interface CoverageAreaWithNorms extends CoverageArea {
  _city_norm?: string;
  _zone_norm?: string;
  _area_norm?: string;
}

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

  async suggestArea(rawAddress: string): Promise<CoverageArea | null> {
    // 1. Fetch all areas (In production, you should CACHE this result for performance)
    const allAreas = await this.coverageAreaRepository.find();

    // 2. Pre-calculate normalized strings once for the whole batch
    const areasWithNorms: CoverageAreaWithNorms[] = allAreas.map((c) => ({
      ...c,
      _city_norm: this.normalizeText(c.city),
      _zone_norm: this.normalizeText(c.zone),
      _area_norm: this.normalizeText(c.area),
    }));

    // 3. Run the heuristic matching logic
    return this.findBestCoverageAreaFromAddress(rawAddress, areasWithNorms);
  }

  // ===========================================================================
  // PRIVATE HELPER METHODS
  // ===========================================================================

  private findBestCoverageAreaFromAddress(
    rawAddress: string,
    coverageAreas: CoverageAreaWithNorms[],
  ): CoverageArea | null {
    const addrNorm = this.normalizeText(rawAddress);
    const addrNormWS = ` ${addrNorm} `;
    const addrTokens = this.tokenizeAddress(rawAddress);

    // --------------------------------
    // Build city map once from passed areas
    // --------------------------------
    const cityMap = new Map<string, CoverageAreaWithNorms[]>();
    for (const c of coverageAreas) {
      const cn = c._city_norm;
      if (!cn) continue;
      const list = cityMap.get(cn) || [];
      list.push(c);
      cityMap.set(cn, list);
    }
    const cityKeys = Array.from(cityMap.keys());

    // --------------------------------
    // 1. Split into comma parts and normalize
    // --------------------------------
    const partsRaw = rawAddress
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const partsNorm = partsRaw.map((p) => this.normalizeText(p));

    // --------------------------------
    // 2. CITY DETECTION (right to left)
    //    Typically last part is division/city ("Dhaka", "Sylhet", "Narayanganj")
    // --------------------------------
    let cityIndex: number | null = null;
    let candidateCities: string[] = [];

    for (let i = partsNorm.length - 1; i >= 0; i--) {
      const segment = partsNorm[i];
      if (!segment) continue;

      let bestCityKey = '';
      let bestSim = 0;

      for (const cityKey of cityKeys) {
        if (!cityKey) continue;
        const sim = this.similarity(segment, cityKey);
        if (sim > bestSim) {
          bestSim = sim;
          bestCityKey = cityKey;
        }
      }

      // strict for city
      if (bestSim >= 0.8) {
        candidateCities = [bestCityKey];
        cityIndex = i;
        break;
      }
    }

    // fallback: old full-address gating if no city found from parts
    if (candidateCities.length === 0) {
      const matchedCityKeys = cityKeys.filter(
        (k) => k && addrNormWS.includes(` ${k} `),
      );
      if (matchedCityKeys.length > 0) {
        candidateCities = matchedCityKeys;
      }
    }

    let candidates: CoverageAreaWithNorms[] = coverageAreas;
    if (candidateCities.length > 0) {
      candidates = candidateCities.flatMap((key) => cityMap.get(key) || []);
    }

    // --------------------------------
    // 3. ZONE / AREA DETECTION from parts (right to left)
    // --------------------------------
    let bestZoneCandidate: CoverageAreaWithNorms | null = null;
    let bestZoneSim = 0;

    for (let i = partsNorm.length - 1; i >= 0; i--) {
      if (cityIndex !== null && i === cityIndex) continue; // skip the city segment

      const segment = partsNorm[i];
      if (!segment || segment.length < 3) continue;

      for (const c of candidates) {
        const zoneNorm = c._zone_norm || '';
        const areaNorm = c._area_norm || '';

        const simZone = zoneNorm ? this.similarity(segment, zoneNorm) : 0;
        const simArea = areaNorm ? this.similarity(segment, areaNorm) : 0;
        const sim = Math.max(simZone, simArea);

        if (sim > bestZoneSim) {
          bestZoneSim = sim;
          bestZoneCandidate = c;
        }
      }

      // If this part clearly matches a zone/area (e.g. "bashundhora r a", "mirpur 10")
      if (bestZoneSim >= 0.8 && bestZoneCandidate) {
        return bestZoneCandidate;
      }
    }

    const zoneBackup =
      bestZoneCandidate && bestZoneSim >= 0.7 ? bestZoneCandidate : null;

    // --------------------------------
    // 4. OLD LOGIC: exact zone phrase, keyword+number, Jaccard
    // --------------------------------

    // 4.1 Exact zone phrase: "gulshan 1", "banani"
    const zonesSeen = new Map<string, CoverageAreaWithNorms>();
    for (const c of candidates) {
      if (!c._zone_norm) continue;
      if (!zonesSeen.has(c._zone_norm)) zonesSeen.set(c._zone_norm, c);
    }

    const exactZoneNorms: string[] = [];
    for (const [zn] of zonesSeen.entries()) {
      if (!zn) continue;
      if (addrNormWS.includes(` ${zn} `)) {
        exactZoneNorms.push(zn);
      }
    }

    if (exactZoneNorms.length > 0) {
      const exactCandidates = candidates.filter((c) =>
        exactZoneNorms.includes(c._zone_norm || ''),
      );
      // Prefer "Inside Dhaka" if multiple matches (business logic preference)
      const insideDhaka = exactCandidates.filter(
        (c) => String(c.inside_dhaka_flag).toUpperCase() === 'TRUE',
      );
      const picked = insideDhaka[0] || exactCandidates[0];
      return picked;
    }

    // 4.2 keyword+number: "sector 14", "mirpur 10", "gulshan 1"
    const patternRegex = /([a-zA-Zঅ-হ]+)\s*(\d+)/g;
    const keywordNumPairs: { word: string; num: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = patternRegex.exec(addrNorm)) !== null) {
      keywordNumPairs.push({ word: m[1], num: m[2] });
    }

    // 4.2.a exact "word num" phrase inside zone
    const strongMatches: CoverageAreaWithNorms[] = [];
    for (const { word, num } of keywordNumPairs) {
      const phrase = `${word} ${num}`;
      const phraseWS = ` ${phrase} `;
      for (const c of candidates) {
        const zn = c._zone_norm || '';
        if (!zn) continue;
        if (` ${zn} `.includes(phraseWS)) {
          strongMatches.push(c);
        }
      }
    }

    if (strongMatches.length > 0) {
      const insideDhaka = strongMatches.filter(
        (c) => String(c.inside_dhaka_flag).toUpperCase() === 'TRUE',
      );
      return insideDhaka[0] || strongMatches[0];
    }

    // 4.2.b fuzzy keyword+number: "golshan 1" -> "gulshan 1"
    const fuzzyMatches: { area: CoverageAreaWithNorms; score: number }[] = [];
    for (const { word, num } of keywordNumPairs) {
      for (const c of candidates) {
        const zn = c._zone_norm || '';
        if (!zn) continue;
        // require same number inside zone
        if (!` ${zn} `.includes(` ${num} `)) continue;

        const mainZoneText = this.normalizeText(
          (zn || '').replace(/\d+/g, '').trim(),
        );
        const mainWords = mainZoneText.split(' ').filter(Boolean);
        const mainKeyword = mainWords[0] || mainZoneText;

        const sim = this.similarity(word, mainKeyword);
        if (sim >= 0.7) {
          fuzzyMatches.push({ area: c, score: sim });
        }
      }
    }

    if (fuzzyMatches.length > 0) {
      fuzzyMatches.sort((a, b) => b.score - a.score);
      return fuzzyMatches[0].area;
    }

    // 4.3 Jaccard fallback
    let best: CoverageAreaWithNorms | null = null;
    let bestScore = 0;

    for (const c of candidates) {
      const score = this.scoreCoverageForAddress(addrTokens, c);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    if (best) return best;

    // last fallback: any zone candidate from parts
    return zoneBackup;
  }

  // --- TEXT NORMALIZATION HELPERS ---

  private normalizeText(input?: string | null): string {
    if (!input) return '';
    return input
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ') // keep letters & digits (Bangla + English)
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tokenize address.
   * - keeps numbers (10, 14, 32 etc.)
   * - drops tiny noise words like rd, h, r, no, etc.
   */
  private tokenizeAddress(input?: string | null): string[] {
    const norm = this.normalizeText(input);
    if (!norm) return [];
    return norm
      .split(' ')
      .filter((t) => t.length >= 3 || /^\d+$/.test(t))
      .filter(
        (t) => !['road', 'rd', 'house', 'flat', 'h', 'r', 'no'].includes(t),
      );
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
