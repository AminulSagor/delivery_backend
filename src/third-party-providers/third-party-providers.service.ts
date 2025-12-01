import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThirdPartyProvider } from './entities/third-party-provider.entity';

@Injectable()
export class ThirdPartyProvidersService {
  constructor(
    @InjectRepository(ThirdPartyProvider)
    private readonly providerRepository: Repository<ThirdPartyProvider>,
  ) {}

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
    return await this.providerRepository.findOne({ where: { provider_code: code } });
  }
}
