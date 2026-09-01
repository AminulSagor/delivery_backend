import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateParcelChargesDto {
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Product weight must be a number' },
  )
  @Min(0)
  product_weight: number;

  /** @deprecated Accepted for older clients but ignored by the service. */
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Delivery charge must be a number' },
  )
  @Min(0)
  @IsOptional()
  delivery_charge?: number;

  /** @deprecated Accepted for older clients but ignored by the service. */
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Weight charge must be a number' },
  )
  @Min(0)
  @IsOptional()
  weight_charge?: number;
}
