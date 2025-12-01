import { IsString, IsOptional, IsDateString } from 'class-validator';

// Note: Delivery is now handled through delivery-verifications flow
// Use InitiateDeliveryDto from delivery-verifications module

export class FailedDeliveryDto {
  @IsString()
  reason: string;

  @IsDateString()
  @IsOptional()
  reschedule_date?: string;
}

export class ReturnParcelDto {
  @IsString()
  return_reason: string;
}
