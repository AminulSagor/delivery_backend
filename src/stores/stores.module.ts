import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';
import { Store } from './entities/store.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Hub } from '../hubs/entities/hub.entity';
import { HubManager } from '../hubs/entities/hub-manager.entity';
import { CarrybeeModule } from '../carrybee/carrybee.module';
import { CarrybeeLocationsModule } from '../carrybee-locations/carrybee-locations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Store, Merchant, Hub, HubManager]),
    CarrybeeModule,
    CarrybeeLocationsModule,
  ],
  providers: [StoresService],
  controllers: [StoresController],
  exports: [StoresService],
})
export class StoresModule {}
