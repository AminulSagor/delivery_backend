import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
} from 'class-validator';
import { ParcelStatus } from '../../parcels/entities/parcel.entity';

export class ResolveReportDto {
  @IsNotEmpty()
  @IsEnum(ParcelStatus)
  action_status: ParcelStatus; // e.g., RETURN_TO_MERCHANT, IN_HUB (for retry)

  @IsOptional()
  @IsString()
  admin_notes?: string;
}

export class BulkResolveReportDto extends ResolveReportDto {
  @IsArray()
  @IsNotEmpty()
  parcel_ids: string[];
}
