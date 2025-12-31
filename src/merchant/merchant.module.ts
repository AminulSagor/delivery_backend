import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantService } from './merchant.service';
import { MerchantController } from './merchant.controller';
import { Merchant } from './entities/merchant.entity';
import { MerchantPayoutMethod } from './entities/merchant-payout-method.entity';
import { PayoutTransaction } from './entities/payout-transaction.entity';
import { MerchantInvoice } from './entities/merchant-invoice.entity';
import { Parcel } from '../parcels/entities/parcel.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { EmailService } from '../utils/email.service';
import { SmsService } from '../utils/sms.service';
import { MerchantInvoiceController } from './controllers/merchant-invoice.controller';
import { MerchantInvoiceService } from './services/merchant-invoice.service';
import { InvoiceCalculationService } from './services/invoice-calculation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Merchant,
      MerchantPayoutMethod,
      PayoutTransaction,
      MerchantInvoice,
      Parcel,
      User,
    ]),
    UsersModule,
  ],
  providers: [
    MerchantService,
    MerchantInvoiceService,
    InvoiceCalculationService,
    EmailService,
    SmsService,
  ],
  controllers: [MerchantController, MerchantInvoiceController],
  exports: [MerchantService, MerchantInvoiceService, InvoiceCalculationService],
})
export class MerchantModule {}
