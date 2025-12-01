import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AssignParcelToRiderDto {
  @IsString()
  @IsNotEmpty()
  rider_id: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
