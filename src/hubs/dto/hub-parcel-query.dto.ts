import { IsOptional, IsEnum } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ParcelStatus } from '../../parcels/entities/parcel.entity';

export class HubParcelQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ParcelStatus, { message: 'Invalid parcel status' })
  status?: ParcelStatus;
}
