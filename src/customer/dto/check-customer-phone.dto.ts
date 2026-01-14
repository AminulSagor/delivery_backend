import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CheckCustomerPhoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone_number: string;
}

export class DeliveryAddressDto {
  city: string;
  city_id: number;
  zone: string;
  zone_id: number;
  area: string;
  area_id: number;
  coverage_area_id: string;
}

export class CustomerResponseDto {
  id: string | null;
  customer_name: string;
  phone_number: string;
  secondary_number: string;
  delivery_address: DeliveryAddressDto | null;
  customer_address: string;

  // New Statistics Section
  history?: {
    delivered_count: number;
    cancelled_count: number;
  };
}
