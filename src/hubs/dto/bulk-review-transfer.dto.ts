import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TransferRecordStatus } from '../../common/enums/transfer-record-status.enum';

export class BulkReviewTransferDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  transfer_ids: string[];

  @IsIn([TransferRecordStatus.APPROVED, TransferRecordStatus.DECLINED])
  status: TransferRecordStatus.APPROVED | TransferRecordStatus.DECLINED;

  @IsOptional()
  @IsString()
  rejection_reason?: string;

  @IsOptional()
  @IsString()
  admin_notes?: string;
}
