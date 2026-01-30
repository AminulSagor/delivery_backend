import {
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsString,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateAdvancePaymentDto {
  @IsNotEmpty()
  @IsUUID()
  merchant_id: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  total_parcels: number;

  @IsNotEmpty()
  @IsString()
  payment_method: string;

  @IsNotEmpty()
  @IsNumber()
  total_collectable_amount: number;

  @IsNotEmpty()
  @IsNumber()
  delivery_fee: number;

  @IsNotEmpty()
  @IsNumber()
  cod_charge: number;

  @IsNotEmpty()
  @IsNumber()
  previous_weight_charge: number;

  @IsNotEmpty()
  @IsNumber()
  return_amount: number;

  @IsOptional()
  @IsString()
  admin_note?: string;
}
