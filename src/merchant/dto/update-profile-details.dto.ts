import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDetailsDto {
  // Belongs to MerchantProfile
  @IsOptional()
  @IsUrl()
  profile_img_url?: string;

  // Belongs to Store (Default)
  @IsOptional()
  @IsString()
  business_name?: string;

  // Belongs to User
  @IsOptional()
  @IsString()
  contact_person_name?: string; // Maps to User.full_name

  @IsOptional()
  @IsString()
  @Matches(/^(?:\+?88)?01[3-9]\d{8}$/, {
    message:
      'contact_number must be a valid Bangladesh number (01XXXXXXXXX or +8801XXXXXXXXX)',
  })
  contact_number?: string; // Maps to User.phone

  @IsOptional()
  @IsEmail()
  contact_email?: string; // Maps to User.email

  @IsOptional()
  @IsString()
  @Matches(/^(?:\+?88)?01[3-9]\d{8}$/, {
    message:
      'optional_phone_number must be a valid Bangladesh number (01XXXXXXXXX or +8801XXXXXXXXX)',
  })
  optional_phone_number?: string; // Maps to Merchant.secondary_number

  // Backward-compatible alias
  @ValidateIf((o) => o.optional_phone_number === undefined)
  @IsOptional()
  @IsString()
  @Matches(/^(?:\+?88)?01[3-9]\d{8}$/, {
    message:
      'secondary_number must be a valid Bangladesh number (01XXXXXXXXX or +8801XXXXXXXXX)',
  })
  secondary_number?: string;
}

export class UpdateNidDto {
  @IsNotEmpty() @IsString() nid_number: string;
  @IsNotEmpty() @IsUrl() nid_front_url: string;
  @IsNotEmpty() @IsUrl() nid_back_url: string;
}

export class UpdateTradeLicenseDto {
  @IsNotEmpty() @IsString() trade_license_number: string;
  @IsNotEmpty() @IsUrl() trade_license_url: string;
}

export class UpdateTinDto {
  @IsNotEmpty() @IsString() tin_number: string;
  @IsNotEmpty() @IsUrl() tin_certificate_url: string;
}

export class UpdateBinDto {
  @IsNotEmpty() @IsString() bin_number: string;
  @IsNotEmpty() @IsUrl() bin_certificate_url: string;
}
