import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ParcelIssueType } from 'src/parcels/entities/parcel.entity';

export class ParcelReportQueryDto {
  @IsOptional()
  @IsString()
  search?: string; // Parcel ID or Customer Name

  @IsOptional()
  @IsEnum(ParcelIssueType)
  issue_type?: ParcelIssueType;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
