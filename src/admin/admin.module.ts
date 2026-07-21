import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminEmailTestController } from './controllers/admin-email-test.controller';
import { AdminSmsTestController } from './controllers/admin-sms-test.controller';
import { AdminSmsPreferencesController } from './controllers/admin-sms-preferences.controller';
import { User } from '../users/entities/user.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Parcel } from '../parcels/entities/parcel.entity';
import { HubTransferRecord } from '../hubs/entities/hub-transfer-record.entity';
import { Store } from '../stores/entities/store.entity';
import { Hub } from '../hubs/entities/hub.entity';
import { HubManager } from '../hubs/entities/hub-manager.entity';
import { HubManagerFinance } from '../hubs/entities/hub-manager-finance.entity';
import { HubExpense } from '../hubs/entities/hub-expense.entity';
import { AdminFinance } from './entities/admin-finance.entity';
import { UsersModule } from '../users/users.module';
import { EmailService } from '../utils/email.service';
import { SmsService } from '../utils/sms.service';
import { AdminAccount } from './entities/admin-account.entity';
import { AdminAccountStatement } from './entities/admin-account-statement.entity';
import { AdminAccountsController } from './controllers/admin-accounts.controller';
import { AdminAccountsService } from './services/admin-accounts.service';
import { SmsPreferencesService } from './services/sms-preferences.service';
import { MerchantModule } from '../merchant/merchant.module';
import { ParcelsModule } from '../parcels/parcels.module';
import { MerchantFinance } from '../merchant-finance/entities/merchant-finance.entity';
import { MerchantFinanceTransaction } from '../merchant-finance/entities/merchant-finance-transaction.entity';
import { SmsPreference } from './entities/sms-preference.entity';
import { SalaryModule } from '../salary/salary.module';
import { PayoutHistoryController } from '../salary/payout-history.controller';
import { Rider } from '../riders/entities/rider.entity';
import { MerchantInvoice } from '../merchant/entities/merchant-invoice.entity';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminDashboardService } from './services/admin-dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      HubTransferRecord,
      Merchant,
      Parcel,
      Store,
      Hub,
      HubManager,
      HubManagerFinance,
      HubExpense,
      AdminFinance,
      AdminAccount,
      AdminAccountStatement,
      MerchantFinance,
      MerchantFinanceTransaction,
      SmsPreference,
      Rider,
      MerchantInvoice,
    ]),
    UsersModule,
    forwardRef(() => MerchantModule),
    ParcelsModule,
    SalaryModule,
  ],
  controllers: [
    PayoutHistoryController,
    AdminAccountsController,
    AdminController,
    AdminEmailTestController,
    AdminSmsTestController,
    AdminSmsPreferencesController,
    AdminDashboardController,
  ],
  providers: [
    AdminService,
    EmailService,
    SmsService,
    AdminAccountsService,
    SmsPreferencesService,
    AdminDashboardService,
  ],
  exports: [AdminAccountsService], // Export service if needed by Payout/Settlement modules
})
export class AdminModule {}
