import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum CustomerFraudReviewAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewCustomerFraudDto {
  @IsEnum(CustomerFraudReviewAction)
  action: CustomerFraudReviewAction;

  @IsOptional()
  @IsString()
  admin_note?: string;
}
