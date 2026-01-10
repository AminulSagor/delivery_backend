import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CheckCustomerPhoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone_number: string;
}

export class CustomerResponseDto {
  id: string | null;
  customer_name: string;
  phone_number: string;
  secondary_number: string;
  delivery_address: string;
}
