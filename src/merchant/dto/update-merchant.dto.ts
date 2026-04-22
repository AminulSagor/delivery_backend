import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  IsEmail,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for admin to update individual store fields.
 * The store `id` is required to identify which store to update.
 */
export class AdminUpdateStoreDto {
  @IsUUID()
  id: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(255)
  business_name?: string;

  @IsString()
  @IsOptional()
  business_address?: string;

  @IsString()
  @IsOptional()
  @Matches(/^01[0-9]{9}$/, {
    message: 'Phone number must be valid BD format (01XXXXXXXXX)',
  })
  phone_number?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  thana?: string;

  @IsString()
  @IsOptional()
  area?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  facebook_page?: string;
}

/**
 * DTO for admin to update merchant info.
 * All fields are optional — admin can patch individually or in groups.
 *
 * Examples:
 *  - Only NID number: { "nid_number": "1234567890" }
 *  - NID + Trade License: { "nid_number": "123", "trade_license_number": "TL-456" }
 *  - Store info: { "stores": [{ "id": "uuid", "business_name": "New Name" }] }
 *  - Mixed: { "nid_number": "123", "stores": [...] }
 */
export class UpdateMerchantDto {
  // === Merchant basic fields ===
  @IsString()
  @IsOptional()
  fullAddress?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(?:\+?88)?01[3-9]\d{8}$/, {
    message: 'secondaryNumber must be a valid Bangladesh number',
  })
  secondaryNumber?: string;

  @IsString()
  @IsOptional()
  thana?: string;

  @IsString()
  @IsOptional()
  district?: string;

  // === Document fields (individually patchable) ===
  @IsString()
  @IsOptional()
  nid_number?: string;

  @IsString()
  @IsOptional()
  trade_license_number?: string;

  @IsString()
  @IsOptional()
  bin_number?: string;

  // === Store edits (array of partial store updates) ===
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdminUpdateStoreDto)
  stores?: AdminUpdateStoreDto[];
}
