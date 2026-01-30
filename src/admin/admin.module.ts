import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminEmailTestController } from './controllers/admin-email-test.controller';
import { AdminSmsTestController } from './controllers/admin-sms-test.controller';
import { User } from '../users/entities/user.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Parcel } from '../parcels/entities/parcel.entity';
import { HubTransferRecord } from '../hubs/entities/hub-transfer-record.entity';
import { UsersModule } from '../users/users.module';
import { EmailService } from '../utils/email.service';
import { SmsService } from '../utils/sms.service';
import { AdminAccount } from './entities/admin-account.entity';
import { AdminAccountStatement } from './entities/admin-account-statement.entity';
import { AdminAccountsController } from './controllers/admin-accounts.controller';
import { AdminAccountsService } from './services/admin-accounts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      HubTransferRecord,
      Merchant,
      Parcel,
      AdminAccount,
      AdminAccountStatement,
    ]),
    UsersModule,
  ],
  controllers: [
    AdminAccountsController,
    AdminController,
    AdminEmailTestController,
    AdminSmsTestController,
  ],
  providers: [AdminService, EmailService, SmsService, AdminAccountsService],
  exports: [AdminAccountsService], // Export service if needed by Payout/Settlement modules
})
export class AdminModule {}
