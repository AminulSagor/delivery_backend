import { IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';

export enum MerchantActionType {
  APPROVE = 'APPROVE',
  REQUEST_REVIEW = 'REQUEST_REVIEW',
}

export class MerchantActionDto {
  @IsNotEmpty()
  @IsEnum(MerchantActionType)
  action: MerchantActionType;

  @IsOptional()
  @IsString()
  review_note?: string;
}
