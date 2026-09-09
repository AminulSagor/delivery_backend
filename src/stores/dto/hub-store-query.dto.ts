import { IsEnum, IsOptional } from 'class-validator';
import { StoreStatus } from '../entities/store.entity';

export class HubStoreQueryDto {
  @IsOptional()
  @IsEnum(StoreStatus, {
    message: 'Status must be PENDING, APPROVED, DECLINED, or DISABLED',
  })
  status?: StoreStatus;
}
