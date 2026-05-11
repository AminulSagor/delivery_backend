import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ParcelIssueType } from 'src/parcels/entities/parcel.entity';

export class ReportDeliveryIssueDto {
  @IsEnum(ParcelIssueType)
  issue_type: ParcelIssueType;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  note: string;
}
