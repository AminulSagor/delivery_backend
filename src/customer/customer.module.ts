import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { Customer } from './entities/customer.entity';
import { Parcel } from 'src/parcels/entities/parcel.entity';
import { CoverageArea } from 'src/coverage-areas/entities/coverage-area.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, Parcel, CoverageArea])],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
