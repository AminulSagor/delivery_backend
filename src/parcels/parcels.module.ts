import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParcelsController } from './parcels.controller';
import { ParcelsService } from './parcels.service';
import { Parcel } from './entities/parcel.entity';
import { CoverageArea } from '../coverage-areas/entities/coverage-area.entity';
import { Store } from '../stores/entities/store.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { User } from '../users/entities/user.entity';
import { Rider } from '../riders/entities/rider.entity';
import { Hub } from '../hubs/entities/hub.entity';
import { PricingModule } from '../pricing/pricing.module';
import { CustomerModule } from '../customer/customer.module';
import { PickupRequestsModule } from '../pickup-requests/pickup-requests.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Parcel, CoverageArea, Store, Merchant, Rider, Hub, User]),
    PricingModule,
    CustomerModule,
    PickupRequestsModule,
  ],
  controllers: [ParcelsController],
  providers: [ParcelsService],
  exports: [ParcelsService],
})
export class ParcelsModule {}
