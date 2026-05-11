import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoresService } from '../stores/stores.service';
import { CarrybeeService } from './carrybee.service';
import { CarrybeeApiService } from './carrybee-api.service';
import { dataSourceOptions } from '../data-source';

import { User } from '../users/entities/user.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { MerchantProfile } from '../merchant/entities/merchant-profile.entity';
import { Store } from '../stores/entities/store.entity';
import { Parcel, ParcelStatus } from '../parcels/entities/parcel.entity';
import { ThirdPartyProvider } from '../third-party-providers/entities/third-party-provider.entity';
import { Customer } from '../customer/entities/customer.entity';
import { PickupRequest } from '../pickup-requests/entities/pickup-request.entity';
import { Rider } from '../riders/entities/rider.entity';
import { CoverageArea } from '../coverage-areas/entities/coverage-area.entity';
import { CoverageAreasService } from '../coverage-areas/coverage-areas.service';
import { Hub } from '../hubs/entities/hub.entity';
import { HubManager } from '../hubs/entities/hub-manager.entity';
import { CarrybeeJob } from './entities/carrybee-job.entity';

describe('Carrybee integration (store creation + parcel assignment)', () => {
  let moduleRef: any;
  let userRepo: Repository<User>;
  let merchantRepo: Repository<Merchant>;
  let storeRepo: Repository<Store>;
  let parcelRepo: Repository<Parcel>;
  let providerRepo: Repository<ThirdPartyProvider>;

  const mockStores: any[] = [];
  const mockCarrybeeApi = {
    formatPhoneForCarrybee: (p: string) => p,
    getStores: jest.fn().mockImplementation(() => Promise.resolve(mockStores)),
    createStore: jest.fn().mockImplementation(async (data: any) => {
      const id = `cb_${Math.random().toString(36).substring(2, 9)}`;
      mockStores.push({ id, name: data.name });
      return { success: true };
    }),
    convertWeightToGrams: jest.fn((kg: number) =>
      Math.round(Number(kg) * 1000),
    ),
    mapDeliveryType: jest.fn((t: any) => t || 1),
    createOrder: jest.fn().mockImplementation(async (data: any) => {
      return {
        consignment_id: `cons_${Math.random().toString(36).substring(2, 8)}`,
        delivery_fee: '50',
        cod_fee: 0,
      };
    }),
  } as any;

  beforeAll(async () => {
    const usePostgres =
      process.env.USE_POSTGRES_TEST === 'true' ||
      process.env.CARRYBEE_TEST_DB === 'postgres';
    const entities = [
      User,
      Merchant,
      MerchantProfile,
      Store,
      Parcel,
      Customer,
      PickupRequest,
      Rider,
      ThirdPartyProvider,
      CoverageArea,
      Hub,
      HubManager,
      CarrybeeJob,
    ];

    const typeOrmConfig = usePostgres
      ? {
          ...dataSourceOptions,
          dropSchema: true,
          synchronize: true,
          entities,
        }
      : {
          type: 'sqlite' as const,
          database: ':memory:',
          dropSchema: true,
          entities,
          synchronize: true,
        };

    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(typeOrmConfig),
        TypeOrmModule.forFeature(entities),
      ],
      providers: [
        StoresService,
        CarrybeeService,
        { provide: CarrybeeApiService, useValue: mockCarrybeeApi },
        {
          provide: CoverageAreasService,
          useValue: { validateLocationIds: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    userRepo = moduleRef.get(getRepositoryToken(User)) as Repository<User>;
    merchantRepo = moduleRef.get(
      getRepositoryToken(Merchant),
    ) as Repository<Merchant>;
    storeRepo = moduleRef.get(getRepositoryToken(Store)) as Repository<Store>;
    parcelRepo = moduleRef.get(
      getRepositoryToken(Parcel),
    ) as Repository<Parcel>;
    providerRepo = moduleRef.get(
      getRepositoryToken(ThirdPartyProvider),
    ) as Repository<ThirdPartyProvider>;
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('creates a store and syncs to Carrybee', async () => {
    const storesService = moduleRef.get(StoresService) as StoresService;

    // create user + merchant
    const user = (userRepo.create as any)({
      full_name: 'Test Merchant',
      phone: '01700000001',
      email: 'm@example.com',
      password_hash: 'x',
      role: 'MERCHANT',
      is_active: true,
    } as any);
    await userRepo.save(user);

    const merchant = (merchantRepo.create as any)({
      user_id: user.id,
      thana: 'T1',
      district: 'D1',
    } as any);
    await merchantRepo.save(merchant);

    // Prepare dto -- carrybee location ids arbitrary
    const dto: any = {
      business_name: 'My Test Store',
      business_address: 'Some address',
      phone_number: '01700000002',
      carrybee_city_id: 1,
      carrybee_zone_id: 1,
      carrybee_area_id: 1,
    };

    // Ensure mock getStores returns empty then returns created store
    mockStores.length = 0;

    const created = await storesService.create(user.id, dto);

    expect(created).toBeDefined();
    // after create, CarrybeeApi.createStore should have been called and mockStores should contain an entry
    expect(mockStores.length).toBeGreaterThan(0);
    const stored = await storeRepo.findOne({
      where: { id: created.id } as any,
    });
    expect(stored).toBeTruthy();
    expect(stored?.is_carrybee_synced).toBeTruthy();
    expect(stored?.carrybee_store_id).toBeDefined();
  });

  it('assigns a parcel to Carrybee', async () => {
    const carrybeeService = moduleRef.get(CarrybeeService) as CarrybeeService;

    // create merchant/user
    const user = (userRepo.create as any)({
      full_name: 'Parcel Merchant',
      phone: '01700000003',
      email: 'pm@example.com',
      password_hash: 'x',
      role: 'MERCHANT',
      is_active: true,
    } as any);
    await userRepo.save(user);
    const merchant = (merchantRepo.create as any)({
      user_id: user.id,
      thana: 'T2',
      district: 'D2',
    } as any);
    await merchantRepo.save(merchant);

    // create store (assume carrybee sync already done)
    const store = (storeRepo.create as any)({
      merchant_id: merchant.id,
      store_code: 'TST001',
      business_name: 'Parcel Store',
      business_address: 'Addr',
      phone_number: '01700000004',
      carrybee_city_id: 1,
      carrybee_zone_id: 1,
      carrybee_area_id: 1,
      is_carrybee_synced: true,
      carrybee_store_id: 'cb_store_1',
    } as any);
    await storeRepo.save(store);

    // create provider
    const provider = (providerRepo.create as any)({
      provider_code: 'CARRYBEE',
      provider_name: 'Carrybee',
      is_active: true,
    } as any);
    await providerRepo.save(provider);

    // create parcel
    const tracking = `T${Date.now()}`;
    const parcel = (parcelRepo.create as any)({
      merchant_id: merchant.id,
      store_id: store.id,
      tracking_number: tracking,
      delivery_area: 'Area X',
      customer_name: 'Alice',
      customer_phone: '01700000005',
      customer_address: 'Customer address here',
      product_weight: 1.5,
      cod_amount: 0,
      is_cod: false,
      status: ParcelStatus.IN_HUB,
      current_hub_id: 'hub-1',
      recipient_carrybee_city_id: 1,
      recipient_carrybee_zone_id: 1,
    } as any);
    await parcelRepo.save(parcel);

    const result = await carrybeeService.assignParcelToCarrybee(
      parcel.id,
      {} as any,
      'hub-1',
    );

    expect(result).toBeDefined();
    const updated = await parcelRepo.findOne({
      where: { id: parcel.id } as any,
    });
    expect(updated).toBeTruthy();
    expect(updated?.delivery_provider).toBe('CARRYBEE');
    expect(updated?.carrybee_consignment_id).toBeDefined();
    expect(updated?.status).toBe('ASSIGNED_TO_THIRD_PARTY');
  });
});
