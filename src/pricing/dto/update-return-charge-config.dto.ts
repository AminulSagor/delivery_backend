import { PartialType } from '@nestjs/mapped-types';
import { CreateReturnChargeConfigDto } from './create-return-charge-config.dto';

export class UpdateReturnChargeConfigDto extends PartialType(CreateReturnChargeConfigDto) {}

