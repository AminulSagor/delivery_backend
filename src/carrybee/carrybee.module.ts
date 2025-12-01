import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Store } from '../stores/entities/store.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Parcel } from '../parcels/entities/parcel.entity';
import { ThirdPartyProvider } from '../third-party-providers/entities/third-party-provider.entity';
import { CoverageArea } from '../coverage-areas/entities/coverage-area.entity';
import { CarrybeeApiService } from './carrybee-api.service';
import { CarrybeeService } from './carrybee.service';
import { CarrybeeWebhookService } from './carrybee-webhook.service';
import { CarrybeeController, CarrybeeWebhookController } from './carrybee.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Store, Merchant, Parcel, ThirdPartyProvider, CoverageArea]),
  ],
  controllers: [CarrybeeController, CarrybeeWebhookController],
  providers: [CarrybeeApiService, CarrybeeService, CarrybeeWebhookService],
  exports: [CarrybeeApiService, CarrybeeService],
})
export class CarrybeeModule {}
