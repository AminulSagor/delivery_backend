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
