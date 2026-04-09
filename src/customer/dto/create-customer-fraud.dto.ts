import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateCustomerFraudDto {
  @IsOptional()
  @IsUUID('4', { message: 'Invalid customer_id' })
  customer_id?: string;

  @IsOptional()
  @Matches(/^01[0-9]{9}$/, {
    message: 'phone_number must be in format: 01XXXXXXXXX',
  })
  phone_number?: string;

  @IsNotEmpty({ message: 'Reason is required' })
  @IsString()
  reason: string;
}
