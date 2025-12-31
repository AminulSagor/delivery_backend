import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { PricingConfiguration } from './entities/pricing-configuration.entity';
import { ReturnChargeConfiguration } from './entities/return-charge-configuration.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PricingConfiguration, ReturnChargeConfiguration])],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
