import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { Merchant } from '../merchant/entities/merchant.entity';
import { MerchantProfile } from '../merchant/entities/merchant-profile.entity';
import { HubManager } from '../hubs/entities/hub-manager.entity';
import { Hub } from '../hubs/entities/hub.entity';
import { Rider } from '../riders/entities/rider.entity';
import { EmailService } from 'src/utils/email.service';
import { SmsService } from 'src/utils/sms.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Merchant,
      MerchantProfile,
      HubManager,
      Hub,
      Rider,
    ]),
    UsersModule,
    ConfigModule,
  ],
  providers: [AuthService, EmailService, SmsService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
