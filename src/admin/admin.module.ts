import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminEmailTestController } from './admin-email-test.controller';
import { AdminSmsTestController } from './admin-sms-test.controller';
import { User } from '../users/entities/user.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Parcel } from '../parcels/entities/parcel.entity';
import { HubTransferRecord } from '../hubs/entities/hub-transfer-record.entity';
import { UsersModule } from '../users/users.module';
import { EmailService } from '../utils/email.service';
import { SmsService } from '../utils/sms.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, HubTransferRecord, Merchant, Parcel]),
    UsersModule,
  ],
  controllers: [AdminController, AdminEmailTestController, AdminSmsTestController],
  providers: [AdminService, EmailService, SmsService],
})
export class AdminModule {}
