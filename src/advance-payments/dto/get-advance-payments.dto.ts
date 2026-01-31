import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto'; // Assuming you have this from previous context
import { AdvancePaymentStatus } from '../entities/advance-payment.entity';

export class GetAdvancePaymentsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(AdvancePaymentStatus)
  status?: AdvancePaymentStatus;

  @IsOptional()
  @IsUUID()
  merchant_id?: string; // Admin usage to filter by specific merchant

  @IsOptional()
  @IsString()
  search?: string; // Search by Invoice ID

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;
}
