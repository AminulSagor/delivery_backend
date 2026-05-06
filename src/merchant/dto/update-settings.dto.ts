import { IsEmail, IsOptional, IsString, IsUrl, Matches } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsUrl()
  profile_photo_url?: string; // maps to profile_img_url

  @IsOptional()
  @IsString()
  business_name?: string;

  @IsOptional()
  @IsString()
  contact_person_name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:\+?88)?01[3-9]\d{8}$/, {
    message:
      'contact_number must be a valid Bangladesh number (01XXXXXXXXX or +8801XXXXXXXXX)',
  })
  contact_number?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:\+?88)?01[3-9]\d{8}$/, {
    message:
      'optional_number must be a valid Bangladesh number (01XXXXXXXXX or +8801XXXXXXXXX)',
  })
  optional_number?: string;
}
