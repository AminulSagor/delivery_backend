import { IsOptional, IsString } from 'class-validator';

export class UpdateRiderDocumentsDto {
  @IsString()
  @IsOptional()
  nid_number?: string;

  @IsString()
  @IsOptional()
  nid_front_photo?: string;

  @IsString()
  @IsOptional()
  nid_back_photo?: string;

  @IsString()
  @IsOptional()
  license_no?: string;

  @IsString()
  @IsOptional()
  license_front_photo?: string;

  @IsString()
  @IsOptional()
  license_back_photo?: string;
}
