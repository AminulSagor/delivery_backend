import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { TransferRecordStatus } from '../../common/enums/transfer-record-status.enum';

export class AdminTransferApprovalQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(TransferRecordStatus)
  status?: TransferRecordStatus;

  @IsOptional()
  @IsUUID()
  hubId?: string;

  @IsOptional()
  @IsUUID()
  hubManagerId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsIn([
    'created_at',
    'transfer_date',
    'amount',
    'transferred_amount',
    'status',
    'transfer_id',
    'transaction_reference_id',
  ])
  sortBy: string = 'created_at';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order: 'ASC' | 'DESC' = 'DESC';
}
