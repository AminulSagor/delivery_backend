import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { MerchantModule } from './merchant/merchant.module';
import { UsersModule } from './users/users.module';
import { HubsModule } from './hubs/hubs.module';
import { RidersModule } from './riders/riders.module';
import { AuthModule } from './auth/auth.module';
import { StoresModule } from './stores/stores.module';
import { CoverageAreasModule } from './coverage-areas/coverage-areas.module';
import { ParcelsModule } from './parcels/parcels.module';
import { PricingModule } from './pricing/pricing.module';
import { CustomerModule } from './customer/customer.module';
import { PickupRequestsModule } from './pickup-requests/pickup-requests.module';
import { DeliveryVerificationsModule } from './delivery-verifications/delivery-verifications.module';
import { ThirdPartyProvidersModule } from './third-party-providers/third-party-providers.module';
import { CarrybeeModule } from './carrybee/carrybee.module';
import { CarrybeeLocationsModule } from './carrybee-locations/carrybee-locations.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    AdminModule,
    MerchantModule,
    UsersModule,
    HubsModule,
    RidersModule,
    AuthModule,
    StoresModule,
    CoverageAreasModule,
    ParcelsModule,
    PricingModule,
    CustomerModule,
    PickupRequestsModule,
    DeliveryVerificationsModule,
    ThirdPartyProvidersModule,
    CarrybeeModule,
    CarrybeeLocationsModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
