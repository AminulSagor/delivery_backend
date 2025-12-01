import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryVerificationsController } from './delivery-verifications.controller';
import { DeliveryVerificationsService } from './delivery-verifications.service';
import { DeliveryVerification } from './entities/delivery-verification.entity';
import { Parcel } from '../parcels/entities/parcel.entity';
import { SmsService } from '../utils/sms.service';

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryVerification, Parcel])],
  controllers: [DeliveryVerificationsController],
  providers: [DeliveryVerificationsService, SmsService],
  exports: [DeliveryVerificationsService],
})
export class DeliveryVerificationsModule {}
