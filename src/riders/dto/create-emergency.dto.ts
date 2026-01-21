import { IsEnum, IsOptional, IsNumber, IsString } from 'class-validator';
import { EmergencyType } from '../../common/enums/emergency-type.enum';

export class CreateEmergencyDto {
  @IsEnum(EmergencyType)
  type: EmergencyType;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  location_address?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
