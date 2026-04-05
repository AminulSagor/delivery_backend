import {
  IsString,
  IsOptional,
  IsEmail,
  Matches,
  ValidateIf,
} from 'class-validator';

export class UpdateRiderProfileDto {
  @IsString()
  @IsOptional()
  full_name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^01[0-9]{9}$/, {
    message: 'Phone must be a valid Bangladesh number (01XXXXXXXXX)',
  })
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  // Primary field name for rider app clients
  @IsString()
  @IsOptional()
  @Matches(/^01[0-9]{9}$/, {
    message: 'Optional phone number must be a valid Bangladesh number',
  })
  optional_phone_number?: string;

  // Backward-compatible alias for existing rider field naming
  @ValidateIf((o) => o.optional_phone_number === undefined)
  @IsString()
  @IsOptional()
  @Matches(/^01[0-9]{9}$/, {
    message: 'Guardian phone must be a valid Bangladesh number',
  })
  guardian_mobile_no?: string;
}
