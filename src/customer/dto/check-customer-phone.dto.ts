import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CheckCustomerPhoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone_number: string;
}
