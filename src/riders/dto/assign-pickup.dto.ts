import { IsString, IsNotEmpty } from 'class-validator';

export class AssignPickupToRiderDto {
  @IsString()
  @IsNotEmpty()
  rider_id: string;
}
