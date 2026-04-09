import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CustomerFraudStatus } from '../entities/customer-fraud.entity';

export class CustomerFraudRequestListQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(CustomerFraudStatus)
  status?: CustomerFraudStatus;
}
