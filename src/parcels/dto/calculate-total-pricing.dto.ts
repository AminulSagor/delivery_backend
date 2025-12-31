import { IsUUID, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CalculateTotalPricingDto {
  @IsNotEmpty()
  @IsUUID()
  store_id: string;

  @IsNotEmpty()
  @IsUUID()
  delivery_coverage_area_id: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number = 0.5; // Weight in KG, default 0.5kg

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number = 1; // Quantity of items

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cod_amount?: number = 0; // Cash on Delivery amount in BDT
}

