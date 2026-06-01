import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Staff } from '../staff/entities/staff.entity';
import { StaffFinance } from '../staff/entities/staff-finance.entity';
import { Rider } from '../riders/entities/rider.entity';
import { Parcel } from '../parcels/entities/parcel.entity';
import { SalaryController } from './salary.controller';
import { SalaryService } from './salary.service';
import { PayoutTransaction } from '../merchant/entities/payout-transaction.entity';
import { StaffPayoutMethod } from '../staff/entities/staff-payout-method.entity';
import { PayoutHistoryController } from './payout-history.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Staff,
      StaffFinance,
      PayoutTransaction,
      StaffPayoutMethod,
      Rider,
      Parcel,
    ]),
  ],
  controllers: [SalaryController, PayoutHistoryController],
  providers: [SalaryService],
  exports: [SalaryService],
})
export class SalaryModule {}
