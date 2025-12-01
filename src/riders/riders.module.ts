import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';
import { Rider } from './entities/rider.entity';
import { User } from '../users/entities/user.entity';
import { Parcel } from '../parcels/entities/parcel.entity';
import { PickupRequest } from '../pickup-requests/entities/pickup-request.entity';
import { HubManager } from '../hubs/entities/hub-manager.entity';
import { ParcelsModule } from '../parcels/parcels.module';
import { PickupRequestsModule } from '../pickup-requests/pickup-requests.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Rider, User, Parcel, PickupRequest, HubManager]),
    forwardRef(() => ParcelsModule),
    forwardRef(() => PickupRequestsModule),
  ],
  providers: [RidersService],
  controllers: [RidersController],
  exports: [RidersService],
})
export class RidersModule {}
