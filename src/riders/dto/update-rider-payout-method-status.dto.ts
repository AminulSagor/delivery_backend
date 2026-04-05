import { IsBoolean } from 'class-validator';

export class UpdateRiderPayoutMethodStatusDto {
  @IsBoolean()
  is_active: boolean;
}
