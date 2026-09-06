import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Defines the structure for a single order row received from the frontend
 * during the bulk import review step.
 */
export class BulkOrderItemDto {
  /** Stable frontend row identifier used to map results back to table rows. */
  @IsOptional()
  @IsString()
  row_id?: string;

  @IsOptional()
  @IsUUID()
  store_id?: string;

  @IsNotEmpty()
  @IsString()
  customer_name: string;

  @IsNotEmpty()
  @IsString()
  customer_phone: string;

  @IsOptional()
  @IsString()
  customer_secondary_phone?: string;

  @IsNotEmpty()
  @IsString()
  customer_address: string;

  // Same frontend-provided Barikoi contract used by POST /coverage/address/suggest.
  // `address` may be omitted because customer_address is used as the raw fallback.
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  fixedAddress?: string;

  @IsOptional()
  @IsString()
  addressStatus?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  barikoiScore?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  subArea?: string;

  @IsOptional()
  @IsString()
  thana?: string;

  @IsOptional()
  @IsString()
  delivery_area?: string;

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
  is_exchange_raw?: string; // 'TRUE' or 'FALSE'

  @IsOptional()
  @IsString()
  special_instructions?: string;
}

/**
 * Defines the complete payload for the bulk suggest endpoint (e.g., 15 items).
 */
export class BulkSuggestDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => BulkOrderItemDto)
  items: BulkOrderItemDto[];
}
