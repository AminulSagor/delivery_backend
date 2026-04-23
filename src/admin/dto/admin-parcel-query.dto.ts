import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsString,
  IsNumber,
  IsIn,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ParcelStatus } from '../../parcels/entities/parcel.entity';
import { DeliveryType } from '../../common/enums/delivery-type.enum';

export class AdminParcelQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn([...Object.values(ParcelStatus), 'ACTIVE'], {
    message: 'Invalid parcel status. Use a valid status or ACTIVE',
  })
  status?: ParcelStatus | 'ACTIVE';

  @IsOptional()
  @IsUUID('4', { message: 'Invalid hub ID' })
  hubId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid merchant ID' })
  merchantId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid store ID' })
  storeId?: string;

  @IsOptional()
  @IsString({ message: 'Customer name must be a string' })
  customerName?: string;

  @IsOptional()
  @IsString({ message: 'Customer phone must be a string' })
  customerPhone?: string;

  @IsOptional()
  @IsString({ message: 'Merchant name must be a string' })
  merchantName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Minimum amount must be a number' })
  @Min(0, { message: 'Minimum amount cannot be negative' })
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Maximum amount must be a number' })
  @Min(0, { message: 'Maximum amount cannot be negative' })
  maxAmount?: number;

  @IsOptional()
  @IsEnum(DeliveryType, { message: 'Invalid delivery type' })
  deliveryType?: DeliveryType;
}
