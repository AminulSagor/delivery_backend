import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from './entities/store.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store)
    private storesRepository: Repository<Store>,
    @InjectRepository(Merchant)
    private merchantRepository: Repository<Merchant>,
  ) {}

  async create(userId: string, dto: CreateStoreDto): Promise<Store> {
    // Find the merchant by user_id
    const merchant = await this.merchantRepository.findOne({
      where: { user_id: userId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant profile not found');
    }

    // If setting as default, unset all other default flags for this merchant
    if (dto.is_default === true) {
      await this.storesRepository.update(
        { merchant_id: merchant.id, is_default: true },
        { is_default: false },
      );
    }

    const store = new Store();
    store.merchant_id = merchant.id;
    store.business_name = dto.business_name;
    store.business_address = dto.business_address;
    store.phone_number = dto.phone_number;
    store.email = dto.email ?? null;
    store.facebook_page = dto.facebook_page ?? null;
    store.is_default = dto.is_default || false;

    await this.storesRepository.save(store);

    console.log(
      `[STORE CREATED] Merchant ${merchant.id} created store: ${store.business_name} (${store.id})`,
    );

    return store;
  }

  async findAllByMerchant(userId: string): Promise<Store[]> {
    const merchant = await this.merchantRepository.findOne({
      where: { user_id: userId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant profile not found');
    }

    const stores = await this.storesRepository.find({
      where: { merchant_id: merchant.id },
      order: {
        is_default: 'DESC', // Default first
        created_at: 'DESC',
      },
    });

    return stores;
  }

  async findDefaultStore(userId: string): Promise<Store | null> {
    const merchant = await this.merchantRepository.findOne({
      where: { user_id: userId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant profile not found');
    }

    const defaultStore = await this.storesRepository.findOne({
      where: { merchant_id: merchant.id, is_default: true },
    });

    return defaultStore;
  }

  async findOne(id: string, userId: string): Promise<Store> {
    const merchant = await this.merchantRepository.findOne({
      where: { user_id: userId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant profile not found');
    }

    const store = await this.storesRepository.findOne({
      where: { id, merchant_id: merchant.id },
    });

    if (!store) {
      throw new NotFoundException(
        `Store with ID ${id} not found or does not belong to you`,
      );
    }

    return store;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateStoreDto,
  ): Promise<Store> {
    const store = await this.findOne(id, userId);

    // Update only provided fields
    if (dto.business_name !== undefined)
      store.business_name = dto.business_name;
    if (dto.business_address !== undefined)
      store.business_address = dto.business_address;
    if (dto.phone_number !== undefined) store.phone_number = dto.phone_number;
    if (dto.email !== undefined) store.email = dto.email;
    if (dto.facebook_page !== undefined)
      store.facebook_page = dto.facebook_page;

    await this.storesRepository.save(store);

    console.log(`[STORE UPDATED] Store ${store.id} updated by user ${userId}`);

    return store;
  }

  async setAsDefault(id: string, userId: string): Promise<Store> {
    const merchant = await this.merchantRepository.findOne({
      where: { user_id: userId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant profile not found');
    }

    const store = await this.findOne(id, userId);

    // Unset all other defaults for this merchant
    await this.storesRepository.update(
      { merchant_id: merchant.id, is_default: true },
      { is_default: false },
    );

    // Set this store as default
    store.is_default = true;
    await this.storesRepository.save(store);

    console.log(
      `[STORE DEFAULT SET] Store ${store.id} set as default for merchant ${merchant.id}`,
    );

    return store;
  }

  async remove(id: string, userId: string): Promise<void> {
    const store = await this.findOne(id, userId);

    // Cannot delete default store
    if (store.is_default === true) {
      throw new BadRequestException(
        'Cannot delete default store. Set another store as default first.',
      );
    }

    await this.storesRepository.remove(store);

    console.log(`[STORE DELETED] Store ${id} deleted by user ${userId}`);
  }
}
