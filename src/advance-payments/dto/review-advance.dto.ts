import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UpdateAdvancePaymentDto } from './update-advance.dto';

export enum AdvancePaymentReviewAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewAdvancePaymentDto extends UpdateAdvancePaymentDto {
  @IsEnum(AdvancePaymentReviewAction)
  action: AdvancePaymentReviewAction;

  @IsOptional()
  @IsString()
  admin_note?: string;
}