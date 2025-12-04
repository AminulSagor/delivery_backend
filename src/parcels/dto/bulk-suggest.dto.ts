import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Defines the structure for a single order row received from the frontend
 * during the bulk import review step.
 */
export class BulkOrderItemDto {
  @IsOptional()
  @IsUUID()
  store_id?: string;

  @IsNotEmpty()
  @IsString()
  customer_name: string;

  @IsNotEmpty()
  @IsString()
  customer_phone: string;

  @IsNotEmpty()
  @IsString()
  delivery_address: string;

  @IsNotEmpty()
  @IsString()
  pickup_address: string;

  @IsOptional()
  @IsUUID()
  delivery_coverage_area_id?: string;

  @IsOptional()
  @IsString()
  merchant_order_id?: string;

  @IsOptional()
  @IsString()
  product_description?: string;

  @IsOptional()
  @IsString()
  product_price_raw?: string; // Raw string from CSV for parsing

  @IsOptional()
  @IsString()
  product_weight_raw?: string; // Raw string from CSV for parsing

  @IsOptional()
  @IsString()
  parcel_type_raw?: string;

  @IsOptional()
  @IsString()
  delivery_type_raw?: string;

  @IsOptional()
  @IsString()
  is_cod_raw?: string; // 'TRUE' or 'FALSE'

  @IsOptional()
  @IsString()
  special_instructions?: string;
}

/**
 * Defines the complete payload for the bulk suggest endpoint (e.g., 15 items).
 */
export class BulkSuggestDto {
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkOrderItemDto)
  items: BulkOrderItemDto[];
}
