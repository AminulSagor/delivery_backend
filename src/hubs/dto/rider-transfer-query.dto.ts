import { IsOptional, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class RiderTransferQueryDto extends PaginationDto {
  /** Filter by rider status: on_duty, break, leave */
  @IsOptional()
  @IsIn(['on_duty', 'break', 'leave'], {
    message: 'Status must be one of: on_duty, break, leave',
  })
  status?: 'on_duty' | 'break' | 'leave';
}
