import {
  IsUUID,
  IsArray,
  ArrayNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class BulkTransferFromRidersDto {
  @IsUUID('4')
  target_rider_id: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  source_rider_ids: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  statuses?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
