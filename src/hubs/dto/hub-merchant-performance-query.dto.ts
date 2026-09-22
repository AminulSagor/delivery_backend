import { IsOptional, IsUUID, Matches } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const DATE_ONLY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class HubMerchantPerformanceQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  hub_id?: string;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'start_date must use YYYY-MM-DD format',
  })
  start_date?: string;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'end_date must use YYYY-MM-DD format',
  })
  end_date?: string;
}
