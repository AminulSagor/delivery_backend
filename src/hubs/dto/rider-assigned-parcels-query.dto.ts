import {
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { DeliveryType } from '../../common/enums/delivery-type.enum';

export class RiderAssignedParcelsQueryDto extends PaginationDto {
  /** Filter by delivery area */
  @IsOptional()
  @IsString()
  area?: string;

  /** Filter by merchant ID */
  @IsOptional()
  @IsUUID('4', { message: 'Invalid merchant ID' })
  merchantId?: string;

  /** Filter by merchant name */
  @IsOptional()
  @IsString()
  merchantName?: string;

  /** Filter by delivery type */
  @IsOptional()
  @IsEnum(DeliveryType, { message: 'Invalid delivery type' })
  deliveryType?: DeliveryType;

  /** Filter by minimum COD amount */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Minimum amount must be a number' })
  @Min(0, { message: 'Minimum amount cannot be negative' })
  minAmount?: number;

  /** Filter by maximum COD amount */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Maximum amount must be a number' })
  @Min(0, { message: 'Maximum amount cannot be negative' })
  maxAmount?: number;

  /** Filter by parcel status (defaults to active assigned statuses) */
  @IsOptional()
  @IsString()
  status?: string;
}
