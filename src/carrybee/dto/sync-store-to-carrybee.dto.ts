import { IsInt, IsNotEmpty } from 'class-validator';

export class SyncStoreToCarrybeeDto {
  @IsInt()
  @IsNotEmpty()
  carrybee_city_id: number;

  @IsInt()
  @IsNotEmpty()
  carrybee_zone_id: number;

  @IsInt()
  @IsNotEmpty()
  carrybee_area_id: number;
}
