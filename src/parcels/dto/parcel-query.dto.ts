import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ParcelStatus } from '../entities/parcel.entity';

export class ParcelQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ParcelStatus, { message: 'Invalid parcel status' })
  status?: ParcelStatus;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid store ID' })
  storeId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid merchant ID' })
  merchantId?: string;
}
