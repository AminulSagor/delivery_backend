import { PartialType } from '@nestjs/mapped-types';
import { AddRiderPayoutMethodDto } from './add-rider-payout-method.dto';

export class UpdateRiderPayoutMethodDto extends PartialType(
  AddRiderPayoutMethodDto,
) {}
