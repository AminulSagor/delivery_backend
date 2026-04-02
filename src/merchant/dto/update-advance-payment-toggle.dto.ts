import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateAdvancePaymentToggleDto {
  @IsNotEmpty()
  @IsBoolean()
  is_advance_payment_disabled: boolean;
}
