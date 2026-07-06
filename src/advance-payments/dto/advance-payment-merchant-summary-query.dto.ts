import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class AdvancePaymentMerchantSummaryQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  merchant_id?: string;

  @IsOptional()
  @IsUUID()
  hub_id?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  sort_by?:
    | 'merchant_name'
    | 'total_transactions'
    | 'advance_paid'
    | 'successful_parcels' = 'advance_paid';

  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC' = 'DESC';
}
