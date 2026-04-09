import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { Customer } from './entities/customer.entity';
import { CustomerFraud } from './entities/customer-fraud.entity';
import { Parcel } from 'src/parcels/entities/parcel.entity';
import { CoverageArea } from 'src/coverage-areas/entities/coverage-area.entity';
import { CustomerFraudService } from './customer-fraud.service';
import { CustomerFraudController } from './customer-fraud.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, Parcel, CoverageArea, CustomerFraud]),
  ],
  controllers: [CustomerController, CustomerFraudController],
  providers: [CustomerService, CustomerFraudService],
  exports: [CustomerService],
})
export class CustomerModule {}
