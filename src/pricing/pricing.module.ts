import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { PricingConfiguration } from './entities/pricing-configuration.entity';
import { ReturnChargeConfiguration } from './entities/return-charge-configuration.entity';
import { PricingDefaultConfiguration } from './entities/pricing-default-configuration.entity';
import { ReturnChargeDefaultConfiguration } from './entities/return-charge-default-configuration.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PricingConfiguration,
      ReturnChargeConfiguration,
      PricingDefaultConfiguration,
      ReturnChargeDefaultConfiguration,
    ]),
  ],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
