import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePickupRequestDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  estimated_parcels?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
