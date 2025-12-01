import { PartialType } from '@nestjs/mapped-types';
import { CreateParcelDto } from './create-parcel.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ParcelStatus, PaymentStatus } from '../entities/parcel.entity';

export class UpdateParcelDto extends PartialType(CreateParcelDto) {
  @IsOptional()
  @IsEnum(ParcelStatus)
  status?: ParcelStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  payment_status?: PaymentStatus;
}
