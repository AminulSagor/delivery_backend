import { IsUUID, IsNotEmpty } from 'class-validator';

export class CalculatePricingDto {
  @IsNotEmpty()
  @IsUUID()
  store_id: string;

  @IsNotEmpty()
  @IsUUID()
  delivery_coverage_area_id: string;
}
