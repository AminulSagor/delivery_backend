import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HubsService } from './hubs.service';
import { HubsController } from './hubs.controller';
import { Hub } from './entities/hub.entity';
import { HubManager } from './entities/hub-manager.entity';
import { HubManagerFinance } from './entities/hub-manager-finance.entity';
import { RiderSettlement } from './entities/rider-settlement.entity';
import { HubTransferRecord } from './entities/hub-transfer-record.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ParcelsModule } from '../parcels/parcels.module';
import { Rider } from '../riders/entities/rider.entity';
import { DeliveryVerification } from '../delivery-verifications/entities/delivery-verification.entity';
import { Store } from '../stores/entities/store.entity';
import { Parcel } from '../parcels/entities/parcel.entity';
import { HubExpense } from './entities/hub-expense.entity';
import { AdminAccount } from 'src/admin/entities/admin-account.entity';
import { HubDashboardService } from './services/hub-dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Hub,
      HubManager,
      HubManagerFinance,
      RiderSettlement,
      HubTransferRecord,
      HubExpense,
      AdminAccount,
      User,
      Rider,
      DeliveryVerification,
      Store,
      Parcel,
    ]),
    forwardRef(() => ParcelsModule),
  ],
  providers: [HubsService, HubDashboardService, UsersService],
  controllers: [HubsController],
  exports: [HubsService],
})
export class HubsModule {}
