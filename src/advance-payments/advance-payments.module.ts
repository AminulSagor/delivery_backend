import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdvancePaymentsService } from './advance-payments.service';
import { AdvancePaymentsController } from './advance-payments.controller';
import { AdvancePayment } from './entities/advance-payment.entity';
import { MerchantFinanceModule } from '../merchant-finance/merchant-finance.module';
import { Merchant } from '../merchant/entities/merchant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdvancePayment, Merchant]),
    MerchantFinanceModule, // CRITICAL: Required for balance deduction
  ],
  controllers: [AdvancePaymentsController],
  providers: [AdvancePaymentsService],
  exports: [AdvancePaymentsService],
})
export class AdvancePaymentsModule {}
