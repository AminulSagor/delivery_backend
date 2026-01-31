import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TransferRecordStatus } from '../../common/enums/transfer-record-status.enum';

export class ReviewFinanceRequestDto {
  @IsNotEmpty()
  @IsEnum(TransferRecordStatus, {
    message: 'Status must be APPROVED or DECLINED',
  })
  status: TransferRecordStatus;

  @IsOptional()
  @IsString()
  rejection_reason?: string; // Mandatory if DECLINED (enforced in service)
}
