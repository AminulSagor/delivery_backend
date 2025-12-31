import { PartialType } from '@nestjs/mapped-types';
import { AddPayoutMethodDto } from './add-payout-method.dto';

export class UpdatePayoutMethodDto extends PartialType(AddPayoutMethodDto) {}

