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
import { AdminAccountStatement } from '../admin/entities/admin-account-statement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Staff,
      StaffFinance,
      PayoutTransaction,
      StaffPayoutMethod,
      Rider,
      Parcel,
      AdminAccountStatement,
    ]),
  ],
  controllers: [SalaryController],
  providers: [SalaryService],
  exports: [SalaryService],
})
export class SalaryModule {}
