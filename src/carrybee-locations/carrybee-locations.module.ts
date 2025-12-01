import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarrybeeLocationsService } from './carrybee-locations.service';
import { CarrybeeLocationsController } from './carrybee-locations.controller';
import { CarrybeeLocation } from './entities/carrybee-location.entity';
import { CarrybeeModule } from '../carrybee/carrybee.module';

@Module({
  imports: [TypeOrmModule.forFeature([CarrybeeLocation]), CarrybeeModule],
  controllers: [CarrybeeLocationsController],
  providers: [CarrybeeLocationsService],
  exports: [CarrybeeLocationsService],
})
export class CarrybeeLocationsModule {}
