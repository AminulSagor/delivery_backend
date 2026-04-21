import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsEnum,
  IsIn,
  IsInt,
  Min,
  Max,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ParcelType } from '../../common/enums/parcel-type.enum';
import { DeliveryType } from '../../common/enums/delivery-type.enum';

export class CreateParcelDto {
  // ===== MERCHANT REFERENCE =====
  // merchant_id comes from JWT (userId), not from body

  @IsOptional()
  @ValidateIf((o) => o.merchant_order_id !== '')
  @IsString()
  @MaxLength(100)
  merchant_order_id?: string; // Merchant's own order reference

  @IsOptional()
  @ValidateIf((o) => o.merchant_id !== '')
  @IsUUID()
  merchant_id?: string;

  @IsOptional()
  @IsUUID()
  store_id?: string; // UUID of merchant's store (if using predefined store)

  // ===== DELIVERY AREA (Merchant's pickup location) =====
  @IsNotEmpty()
  @IsString()
  delivery_area: string;

  // ===== CUSTOMER INFORMATION =====
  @IsOptional()
  @IsUUID()
  delivery_coverage_area_id?: string; // Selected from coverage area autocomplete

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  customer_name: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^01[0-9]{9}$/, {
    message: 'Customer phone must be a valid Bangladesh number (01XXXXXXXXX)',
  })
  customer_phone: string;

  @IsOptional()
  @ValidateIf((o) => o.customer_secondary_phone !== '')
  @IsString()
  @Matches(/^01[0-9]{9}$/, {
    message:
      'Customer secondary phone must be a valid Bangladesh number (01XXXXXXXXX)',
  })
  customer_secondary_phone?: string;

  @IsNotEmpty()
  @IsString()
  customer_address: string;

  // ===== RECIPIENT CARRYBEE LOCATION (for Carrybee delivery) =====
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  recipient_carrybee_city_id?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  recipient_carrybee_zone_id?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  recipient_carrybee_area_id?: number;

  // ===== PARCEL DETAILS =====
  @IsOptional()
  @IsString()
  @MaxLength(255)
  product_description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  product_price?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  product_weight?: number; // kg

  @IsOptional()
  @IsNumber()
  @IsIn([1, 2, 3], {
    message: 'Parcel type must be 1 (Parcel), 2 (Book), or 3 (Document)',
  })
  @Type(() => Number)
  parcel_type?: ParcelType;

  @IsOptional()
  @IsNumber()
  @IsIn([1, 2, 3], {
    message: 'Delivery type must be 1 (Normal), 2 (Express), or 3 (Same Day)',
  })
  @Type(() => Number)
  delivery_type?: DeliveryType;

  // ===== EXCHANGE FLAG =====
  // Note: COD amount is automatically set from product_price
  @IsOptional()
  @IsBoolean()
  is_exchange?: boolean; // True if this parcel is an exchange item

  // ===== SPECIAL INSTRUCTIONS =====
  @IsOptional()
  @IsString()
  special_instructions?: string;
}
