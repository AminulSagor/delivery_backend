import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarrybeeLocation, LocationType } from './entities/carrybee-location.entity';
import { CarrybeeApiService } from '../carrybee/carrybee-api.service';

@Injectable()
export class CarrybeeLocationsService {
  private readonly logger = new Logger(CarrybeeLocationsService.name);

  constructor(
    @InjectRepository(CarrybeeLocation)
    private readonly locationRepository: Repository<CarrybeeLocation>,
    private readonly carrybeeApiService: CarrybeeApiService,
  ) {}

  // Sync all locations from Carrybee to our database
  async syncLocationsFromCarrybee(): Promise<{
    cities: number;
    zones: number;
    areas: number;
  }> {
    this.logger.log('Starting Carrybee locations sync...');

    let citiesCount = 0;
    let zonesCount = 0;
    let areasCount = 0;

    try {
      // 1. Fetch and sync cities
      const cities = await this.carrybeeApiService.getCities();
      this.logger.log(`Fetched ${cities.length} cities from Carrybee`);

      for (const city of cities) {
        await this.locationRepository.upsert(
          {
            carrybee_id: city.id,
            name: city.name,
            type: LocationType.CITY,
            parent_id: null,
            city_id: city.id,
            is_active: true,
          },
          ['carrybee_id', 'type'],
        );
        citiesCount++;

        // 2. Fetch and sync zones for this city
        try {
          const zones = await this.carrybeeApiService.getZones(city.id);
          this.logger.log(`Fetched ${zones.length} zones for city ${city.name}`);

          for (const zone of zones) {
            await this.locationRepository.upsert(
              {
                carrybee_id: zone.id,
                name: zone.name,
                type: LocationType.ZONE,
                parent_id: city.id,
                city_id: city.id,
                is_active: true,
              },
              ['carrybee_id', 'type'],
            );
            zonesCount++;

            // 3. Fetch and sync areas for this zone
            try {
              const areas = await this.carrybeeApiService.getAreas(city.id, zone.id);
              this.logger.log(`Fetched ${areas.length} areas for zone ${zone.name}`);

              for (const area of areas) {
                await this.locationRepository.upsert(
                  {
                    carrybee_id: area.id,
                    name: area.name,
                    type: LocationType.AREA,
                    parent_id: zone.id,
                    city_id: city.id,
                    is_active: true,
                  },
                  ['carrybee_id', 'type'],
                );
                areasCount++;
              }
            } catch (error) {
              this.logger.error(`Failed to fetch areas for zone ${zone.id}`, error.message);
            }
          }
        } catch (error) {
          this.logger.error(`Failed to fetch zones for city ${city.id}`, error.message);
        }
      }

      this.logger.log(
        `Sync completed: ${citiesCount} cities, ${zonesCount} zones, ${areasCount} areas`,
      );

      return { cities: citiesCount, zones: zonesCount, areas: areasCount };
    } catch (error) {
      this.logger.error('Failed to sync locations from Carrybee', error.message);
      throw error;
    }
  }

  // Get all cities
  async getCities() {
    return this.locationRepository.find({
      where: { type: LocationType.CITY, is_active: true },
      order: { name: 'ASC' },
    });
  }

  // Get zones by city
  async getZonesByCity(cityId: number) {
    return this.locationRepository.find({
      where: { type: LocationType.ZONE, parent_id: cityId, is_active: true },
      order: { name: 'ASC' },
    });
  }

  // Get areas by zone
  async getAreasByZone(zoneId: number) {
    return this.locationRepository.find({
      where: { type: LocationType.AREA, parent_id: zoneId, is_active: true },
      order: { name: 'ASC' },
    });
  }

  // Search locations by name
  async searchLocations(searchTerm: string) {
    return this.locationRepository
      .createQueryBuilder('location')
      .where('LOWER(location.name) LIKE LOWER(:search)', {
        search: `%${searchTerm}%`,
      })
      .andWhere('location.is_active = :active', { active: true })
      .orderBy('location.type', 'ASC')
      .addOrderBy('location.name', 'ASC')
      .limit(50)
      .getMany();
  }

  // Validate location IDs exist
  async validateLocationIds(
    cityId: number,
    zoneId: number,
    areaId: number,
  ): Promise<boolean> {
    const city = await this.locationRepository.findOne({
      where: { carrybee_id: cityId, type: LocationType.CITY, is_active: true },
    });

    const zone = await this.locationRepository.findOne({
      where: {
        carrybee_id: zoneId,
        type: LocationType.ZONE,
        parent_id: cityId,
        is_active: true,
      },
    });

    const area = await this.locationRepository.findOne({
      where: {
        carrybee_id: areaId,
        type: LocationType.AREA,
        parent_id: zoneId,
        is_active: true,
      },
    });

    return !!(city && zone && area);
  }
}
