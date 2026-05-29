import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { Staff } from './entities/staff.entity';
import { User } from '../users/entities/user.entity';
import { Hub } from '../hubs/entities/hub.entity';
import { Rider } from '../riders/entities/rider.entity';
import { HubManager } from '../hubs/entities/hub-manager.entity';
import { PayoutTransaction } from '../merchant/entities/payout-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Staff,
      PayoutTransaction,
      User,
      Hub,
      Rider,
      HubManager,
    ]),
  ],
  providers: [StaffService],
  controllers: [StaffController],
  exports: [StaffService],
})
export class StaffModule {}
