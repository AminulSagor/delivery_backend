import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Store } from '../stores/entities/store.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Parcel } from '../parcels/entities/parcel.entity';
import { ThirdPartyProvider } from '../third-party-providers/entities/third-party-provider.entity';
import { CoverageArea } from '../coverage-areas/entities/coverage-area.entity';
import { ReturnChargeConfiguration } from '../pricing/entities/return-charge-configuration.entity';
import { CarrybeeJob } from './entities/carrybee-job.entity';
import { CarrybeeAssignmentWorker } from '../workers/carrybee-assignment.worker';
import { CarrybeeApiService } from './carrybee-api.service';
import { CarrybeeService } from './carrybee.service';
import { CarrybeeWebhookService } from './carrybee-webhook.service';
import { CarrybeeJobsService } from './carrybee-jobs.service';
import { CarrybeeJobsController } from './carrybee-jobs.controller';
import {
  CarrybeeController,
  CarrybeeWebhookController,
} from './carrybee.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Store,
      Merchant,
      Parcel,
      ThirdPartyProvider,
      CoverageArea,
      ReturnChargeConfiguration,
      CarrybeeJob,
    ]),
  ],
  controllers: [
    CarrybeeController,
    CarrybeeWebhookController,
    CarrybeeJobsController,
  ],
  providers: [
    CarrybeeApiService,
    CarrybeeService,
    CarrybeeWebhookService,
    CarrybeeAssignmentWorker,
    CarrybeeJobsService,
  ],
  exports: [CarrybeeApiService, CarrybeeService],
})
export class CarrybeeModule {}
