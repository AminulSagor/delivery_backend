import { IsUUID, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CalculatePricingDto {
  @IsNotEmpty()
  @IsUUID()
  store_id: string;

  @IsNotEmpty()
  @IsUUID()
  delivery_coverage_area_id: string;

  @IsNumber({}, { message: 'Weight must be a number' })
  @Min(0, { message: 'Weight cannot be negative' })
  weight_kg: number;

  @IsNumber({}, { message: 'Amount to receive must be a number' })
  @Min(0, { message: 'Amount to receive cannot be negative' })
  amount_to_receive: number;
}
