import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantFinanceController } from './merchant-finance.controller';
import { MerchantFinanceService } from './merchant-finance.service';
import { MerchantFinance } from './entities/merchant-finance.entity';
import { MerchantFinanceTransaction } from './entities/merchant-finance-transaction.entity';
import { User } from '../users/entities/user.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Parcel } from '../parcels/entities/parcel.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MerchantFinance,
      MerchantFinanceTransaction,
      User,
      Merchant,
      Parcel,
    ]),
  ],
  controllers: [MerchantFinanceController],
  providers: [MerchantFinanceService],
  exports: [MerchantFinanceService],
})
export class MerchantFinanceModule {}

