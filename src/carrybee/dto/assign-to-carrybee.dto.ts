import { IsUUID, IsOptional, IsString } from 'class-validator';

export class AssignToCarrybeeDto {
  @IsUUID()
  provider_id: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
