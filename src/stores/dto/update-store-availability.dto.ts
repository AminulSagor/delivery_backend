import { IsBoolean } from 'class-validator';

export class UpdateStoreAvailabilityDto {
  @IsBoolean()
  is_active: boolean;
}
