import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class ApproveTransferRecordDto {
  @IsOptional()
  @IsString()
  admin_notes?: string;
}

export class RejectTransferRecordDto {
  @IsNotEmpty()
  @IsString()
  rejection_reason: string;

  @IsOptional()
  @IsString()
  admin_notes?: string;
}

