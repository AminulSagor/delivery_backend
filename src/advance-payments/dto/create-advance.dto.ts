import {
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsString,
  IsOptional,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

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
  @Transform(
    ({ obj, value }) =>
      obj.collectable_amount ?? obj.collectableAmount ?? value,
  )
  total_collectable_amount: number;

  @IsNotEmpty()
  @IsNumber()
  @Transform(
    ({ obj, value }) => obj.delivery_charge ?? obj.deliveryFee ?? value,
  )
  delivery_fee: number;

  @IsNotEmpty()
  @IsNumber()
  @Transform(({ obj, value }) => obj.cod_charge ?? obj.codCharge ?? value)
  cod_charge: number;

  @IsNotEmpty()
  @IsNumber()
  @Transform(
    ({ obj, value }) =>
      obj.prev_weight_charge ??
      obj.previous_weight_charge ??
      obj.previousWeightCharge ??
      value,
  )
  previous_weight_charge: number;

  @IsNotEmpty()
  @IsNumber()
  @Transform(
    ({ obj, value }) =>
      obj.return_charge ?? obj.return_amount ?? obj.returnAmount ?? value,
  )
  return_amount: number;

  @IsOptional()
  @IsString()
  admin_note?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  update_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hold_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hold_pay?: number;
}
