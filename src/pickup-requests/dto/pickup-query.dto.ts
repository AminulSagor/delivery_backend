import { IsOptional, IsEnum } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PickupRequestStatus } from '../../common/enums/pickup-request-status.enum';

export class PickupQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(PickupRequestStatus, { message: 'Invalid pickup status' })
  status?: PickupRequestStatus;
}

/**
 * Rider Pickup Section filters:
 * - pending: CONFIRMED (assigned to rider, not yet picked up)
 * - completed: PICKED_UP
 */
export enum RiderPickupFilter {
  PENDING = 'pending',     // CONFIRMED - assigned but not picked up
  COMPLETED = 'completed', // PICKED_UP
  ALL = 'all',
}

export class RiderPickupQueryDto {
  @IsOptional()
  @IsEnum(PickupRequestStatus, { message: 'Invalid pickup status' })
  status?: PickupRequestStatus;

  @IsOptional()
  @IsEnum(RiderPickupFilter, { message: 'Invalid filter. Use: pending, completed, all' })
  filter?: RiderPickupFilter;
}
