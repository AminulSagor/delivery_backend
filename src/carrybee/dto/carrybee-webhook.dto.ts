import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CarrybeeWebhookDto {
  @IsString()
  @IsNotEmpty()
  event: string;

  @IsString()
  @IsNotEmpty()
  store_id: string;

  @IsString()
  @IsNotEmpty()
  consignment_id: string;

  @IsString()
  @IsOptional()
  merchant_order_id?: string;

  @IsString()
  @IsNotEmpty()
  timestamptz: string;

  @IsString()
  @IsOptional()
  collectable_amount?: string;

  @IsNumber()
  @IsOptional()
  cod_fee?: number;

  @IsString()
  @IsOptional()
  delivery_fee?: string;

  @IsString()
  @IsOptional()
  collected_amount?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsNumber()
  @IsOptional()
  attempt?: number;

  @IsString()
  @IsOptional()
  invoice_id?: string;
}
