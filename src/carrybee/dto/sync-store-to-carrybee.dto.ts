import { IsInt, IsOptional } from 'class-validator';

export class SyncStoreToCarrybeeDto {
  @IsInt()
  @IsOptional()
  carrybee_city_id?: number;

  @IsInt()
  @IsOptional()
  carrybee_zone_id?: number;

  @IsInt()
  @IsOptional()
  carrybee_area_id?: number;
}
