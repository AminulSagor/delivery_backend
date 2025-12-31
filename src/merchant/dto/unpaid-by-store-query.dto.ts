import { IsOptional, IsUUID } from 'class-validator';

export class UnpaidByStoreQueryDto {
  @IsOptional()
  @IsUUID()
  merchant_id?: string;
}

