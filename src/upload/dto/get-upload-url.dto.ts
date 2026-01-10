// dto/get-upload-url.dto.ts
import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

export enum UploadModule {
  MERCHANTS_NID = 'merchants/nid',
  MERCHANTS_TRADE_LICENSE = 'merchants/trade-license',
  MERCHANTS_TIN = 'merchants/tin',
  MERCHANTS_BIN = 'merchants/bin',
  MERCHANTS_LOGO = 'merchants/logo',
  MERCHANTS_GENERAL = 'merchants/general',

  RIDERS_PROFILE = 'riders/profile',
  RIDERS_NID = 'riders/nid',
  RIDERS_LICENSE = 'riders/license',
  RIDERS_PARENT_NID = 'riders/parent-nid',
}

export class GetUploadUrlDto {
  @IsNotEmpty()
  @IsString()
  fileName: string; // e.g., "my-nid-card.png"

  @IsNotEmpty()
  @IsString()
  fileType: string; // e.g., "image/png"

  @IsEnum(UploadModule)
  module: UploadModule; // e.g. "merchants/nid"
}
