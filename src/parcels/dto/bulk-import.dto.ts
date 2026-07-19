import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { BulkOrderItemDto } from './bulk-suggest.dto';

export class BulkImportDefaultsDto {
  @IsOptional()
  @IsUUID()
  store_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  delivery_area?: string;
}

export interface ParsedBulkImportRow {
  row_number: number;
  item: BulkOrderItemDto;
}
