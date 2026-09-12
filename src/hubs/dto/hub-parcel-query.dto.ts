import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ParcelQueryDto } from '../../parcels/dto/parcel-query.dto';
import { CodStatus } from '../../parcels/entities/parcel.entity';

export class HubParcelQueryDto extends ParcelQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'Invalid rider ID' })
  rider_id?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid provider ID' })
  provider_id?: string;

  @IsOptional()
  @IsEnum(CodStatus, { message: 'Invalid COD status' })
  codStatus?: CodStatus;
}
