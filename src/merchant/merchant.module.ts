import { Module, forwardRef } from '@nestjs/common';
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
import { MerchantProfile } from './entities/merchant-profile.entity';
import { Store } from 'src/stores/entities/store.entity';
import { S3Service } from 'src/upload/s3-upload.service';
import { MerchantFinanceModule } from '../merchant-finance/merchant-finance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Merchant,
      MerchantProfile,
      MerchantPayoutMethod,
      PayoutTransaction,
      MerchantInvoice,
      Parcel,
      User,
      Store,
    ]),
    UsersModule,
    forwardRef(() => MerchantFinanceModule),
  ],
  providers: [
    MerchantService,
    MerchantInvoiceService,
    InvoiceCalculationService,
    EmailService,
    SmsService,
    S3Service,
  ],
  controllers: [MerchantController, MerchantInvoiceController],
  exports: [MerchantService, MerchantInvoiceService, InvoiceCalculationService],
})
export class MerchantModule {}
