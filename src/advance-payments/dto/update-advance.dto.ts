import { PartialType } from '@nestjs/mapped-types';
import { CreateAdvancePaymentDto } from './create-advance.dto';

export class UpdateAdvancePaymentDto extends PartialType(
  CreateAdvancePaymentDto,
) {}
