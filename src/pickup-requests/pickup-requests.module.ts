import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PickupRequestsService } from './pickup-requests.service';
import { PickupRequestsController } from './pickup-requests.controller';
import { PickupRequest } from './entities/pickup-request.entity';
import { Store } from '../stores/entities/store.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Rider } from '../riders/entities/rider.entity';
import { Parcel } from '../parcels/entities/parcel.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PickupRequest, Store, Merchant, Rider, Parcel])],
  controllers: [PickupRequestsController],
  providers: [PickupRequestsService],
  exports: [PickupRequestsService],
})
export class PickupRequestsModule {}
