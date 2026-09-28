import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TransferRecordStatus } from '../../common/enums/transfer-record-status.enum';

export class ReviewFinanceRequestDto {
  @IsNotEmpty()
  @IsIn([TransferRecordStatus.APPROVED, TransferRecordStatus.DECLINED], {
    message: 'Status must be APPROVED or DECLINED',
  })
  status: TransferRecordStatus.APPROVED | TransferRecordStatus.DECLINED;

  @IsOptional()
  @IsString()
  rejection_reason?: string; // Mandatory if DECLINED (enforced in service)

  @IsOptional()
  @IsString()
  admin_notes?: string;
}
