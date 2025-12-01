import { PartialType } from '@nestjs/mapped-types';
import { CreateRiderDto } from './create-rider.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateRiderDto extends PartialType(CreateRiderDto) {
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
