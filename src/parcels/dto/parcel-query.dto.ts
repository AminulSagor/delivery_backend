import { Type } from 'class-transformer';
import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ParcelStatus, PaymentStatus } from '../entities/parcel.entity';

export type ParcelStatusQuery = ParcelStatus | 'ACTIVE';

export class ParcelQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn([...Object.values(ParcelStatus), 'ACTIVE'], {
    message: 'Invalid parcel status. Use a valid status or ACTIVE',
  })
  status?: ParcelStatusQuery;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Days must be an integer' })
  @Min(1, { message: 'Days must be at least 1' })
  @Max(365, { message: 'Days cannot exceed 365' })
  days?: number;

  @IsOptional()
  @IsEnum(PaymentStatus, { message: 'Invalid payment status' })
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid store ID' })
  storeId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid merchant ID' })
  merchantId?: string;
}
