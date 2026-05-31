import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Staff } from '../staff/entities/staff.entity';
import { Rider } from '../riders/entities/rider.entity';
import { Parcel } from '../parcels/entities/parcel.entity';
import { SalaryController } from './salary.controller';
import { SalaryService } from './salary.service';
import { PayoutTransaction } from '../merchant/entities/payout-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Staff, PayoutTransaction, Rider, Parcel])],
  controllers: [SalaryController],
  providers: [SalaryService],
  exports: [SalaryService],
})
export class SalaryModule {}
