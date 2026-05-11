import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThirdPartyProvider } from './entities/third-party-provider.entity';
import {
  CreateThirdPartyProviderDto,
  UpdateThirdPartyProviderDto,
} from './dto/third-party-provider-crud.dto';
import { ParcelStatus } from '../parcels/entities/parcel.entity';
import { DeliveryProvider } from '../common/enums/delivery-provider.enum';

@Injectable()
export class ThirdPartyProvidersService {
  constructor(
    @InjectRepository(ThirdPartyProvider)
    private readonly providerRepository: Repository<ThirdPartyProvider>,
  ) {}

  // --- CREATE ---
  async create(
    createDto: CreateThirdPartyProviderDto,
  ): Promise<ThirdPartyProvider> {
    const existing = await this.providerRepository.findOne({
      where: { provider_code: createDto.provider_code },
    });

    if (existing) {
      throw new ConflictException(
        `Provider with code ${createDto.provider_code} already exists`,
      );
    }

    const provider = this.providerRepository.create(createDto);
    return await this.providerRepository.save(provider);
  }

  async findAllActive(): Promise<ThirdPartyProvider[]> {
    return await this.providerRepository.find({
      where: { is_active: true },
      order: { provider_name: 'ASC' },
    });
  }

  async findAll(): Promise<ThirdPartyProvider[]> {
    return await this.providerRepository.find({
      order: { provider_name: 'ASC' },
    });
  }

  /**
   * Return providers with aggregated stats such as delivered parcel counts.
   * If `isActive` is provided, filters providers by active status.
   */
  async findAllWithStats(isActive?: boolean): Promise<any[]> {
    const successfulStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.PAID_RETURN,
    ];

    const qb = this.providerRepository
      .createQueryBuilder('provider')
      // join parcels only for counting successful deliveries
      .leftJoin(
        'parcels',
        'parcel',
        'parcel.third_party_provider_id = provider.id AND parcel.status IN (:...statuses)',
        { statuses: successfulStatuses },
      )
      .select([
        'provider.id',
        'provider.provider_code',
        'provider.provider_name',
        'provider.description',
        'provider.is_active',
        'provider.created_at',
        'provider.updated_at',
      ])
      .addSelect('COUNT(parcel.id)', 'delivered_count')
      .addSelect(
        'SUM(CASE WHEN parcel.delivery_provider = :carrybee THEN 1 ELSE 0 END)',
        'carrybee_count',
      )
      .groupBy('provider.id')
      .orderBy('provider.provider_name', 'ASC')
      .setParameter('carrybee', DeliveryProvider.CARRYBEE);

    if (isActive !== undefined) {
      qb.where('provider.is_active = :isActive', { isActive });
    }

    const raw = await qb.getRawMany();

    return raw.map((row: any) => ({
      id: row.provider_id,
      provider_code: row.provider_provider_code,
      provider_name: row.provider_provider_name,
      description: row.provider_description,
      is_active: row.provider_is_active,
      created_at: row.provider_created_at,
      updated_at: row.provider_updated_at,
      delivered_count: Number(row.delivered_count || 0),
      unique_id: row.provider_provider_code,
      // if any parcel for this provider has delivery_provider=CARRYBEE, mark type as CARRYBEE
      type:
        Number(row.carrybee_count || 0) > 0
          ? DeliveryProvider.CARRYBEE
          : 'THIRD_PARTY',
    }));
  }

  async findOneWithStats(id: string): Promise<any> {
    const results = await this.findAllWithStats(undefined);
    const found = results.find((r) => r.id === id || r.provider_code === id);
    return found || null;
  }

  async findOne(id: string): Promise<ThirdPartyProvider | null> {
    return await this.providerRepository.findOne({ where: { id } });
  }

  async findByCode(code: string): Promise<ThirdPartyProvider | null> {
    return await this.providerRepository.findOne({
      where: { provider_code: code },
    });
  }

  // --- UPDATE ---
  async update(
    id: string,
    updateDto: UpdateThirdPartyProviderDto,
  ): Promise<ThirdPartyProvider> {
    const provider = await this.findOne(id); // Checks existence

    if (!provider) {
      throw new NotFoundException(
        `Third-party provider with ID ${id} not found`,
      );
    }

    // Validate unique code if changing it
    if (
      updateDto.provider_code &&
      updateDto.provider_code !== provider.provider_code
    ) {
      const existing = await this.providerRepository.findOne({
        where: { provider_code: updateDto.provider_code },
      });
      if (existing) {
        throw new ConflictException(
          `Provider code ${updateDto.provider_code} is already in use`,
        );
      }
    }

    Object.assign(provider, updateDto);
    return await this.providerRepository.save(provider);
  }

  // --- DELETE ---
  async remove(id: string): Promise<void> {
    const result = await this.providerRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(
        `Third-party provider with ID ${id} not found`,
      );
    }
  }
}
