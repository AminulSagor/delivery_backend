import { IsString, IsOptional, IsUrl, IsNotEmpty } from 'class-validator';

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
  contact_number?: string; // Maps to User.phone
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
