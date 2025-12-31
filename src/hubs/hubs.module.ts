import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HubsService } from './hubs.service';
import { HubsController } from './hubs.controller';
import { Hub } from './entities/hub.entity';
import { HubManager } from './entities/hub-manager.entity';
import { RiderSettlement } from './entities/rider-settlement.entity';
import { HubTransferRecord } from './entities/hub-transfer-record.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ParcelsModule } from '../parcels/parcels.module';
import { Rider } from '../riders/entities/rider.entity';
import { DeliveryVerification } from '../delivery-verifications/entities/delivery-verification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Hub,
      HubManager,
      RiderSettlement,
      HubTransferRecord,
      User,
      Rider,
      DeliveryVerification,
    ]),
    forwardRef(() => ParcelsModule),
  ],
  providers: [HubsService, UsersService],
  controllers: [HubsController],
  exports: [HubsService],
})
export class HubsModule {}
