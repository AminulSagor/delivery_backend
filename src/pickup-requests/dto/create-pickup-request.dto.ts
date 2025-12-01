import { IsUUID, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePickupRequestDto {
  @IsUUID()
  store_id: string;

  @IsInt()
  @Min(1)
  estimated_parcels: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
