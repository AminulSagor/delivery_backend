import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  customer_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone_number: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  secondary_number?: string;

  @IsString()
  @IsNotEmpty()
  delivery_address: string;
}
