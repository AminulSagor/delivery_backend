import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantService } from './merchant.service';
import { MerchantController } from './merchant.controller';
import { Merchant } from './entities/merchant.entity';
import { UsersModule } from '../users/users.module';
import { EmailService } from '../utils/email.service';
import { SmsService } from '../utils/sms.service';

@Module({
  imports: [TypeOrmModule.forFeature([Merchant]), UsersModule],
  providers: [MerchantService, EmailService, SmsService],
  controllers: [MerchantController],
  exports: [MerchantService],
})
export class MerchantModule {}
