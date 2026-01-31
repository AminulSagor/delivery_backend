import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';
import { RiderFinanceService } from './services/riders-finance.service';
import { RiderFinanceController } from './controllers/riders-finance.controller';
import { Rider } from './entities/rider.entity';
import { RiderFinance } from './entities/rider-finance.entity';
import { User } from '../users/entities/user.entity';
import { Parcel } from '../parcels/entities/parcel.entity';
import { PickupRequest } from '../pickup-requests/entities/pickup-request.entity';
import { HubManager } from '../hubs/entities/hub-manager.entity';
import { Hub } from '../hubs/entities/hub.entity';
import { ParcelsModule } from '../parcels/parcels.module';
import { PickupRequestsModule } from '../pickup-requests/pickup-requests.module';
import { EmergencyAlert } from './entities/emergency-alert.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Rider,
      RiderFinance,
      User,
      Parcel,
      PickupRequest,
      HubManager,
      Hub,
      EmergencyAlert,
    ]),
    forwardRef(() => ParcelsModule),
    forwardRef(() => PickupRequestsModule),
  ],
  providers: [RidersService, RiderFinanceService],
  controllers: [RidersController, RiderFinanceController],
  exports: [RidersService, RiderFinanceService],
})
export class RidersModule { }
