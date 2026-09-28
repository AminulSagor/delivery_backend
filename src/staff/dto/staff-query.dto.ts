import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { StaffPosition } from '../../common/enums/staff-position.enum';

export class StaffQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 10;

  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(StaffPosition)
  @IsOptional()
  position?: StaffPosition;

  @IsUUID()
  @IsOptional()
  hub_id?: string;

  @Transform(({ value, obj, key }) => {
    const rawValue = obj?.[key] ?? value;
    if (rawValue === true || rawValue === 'true') return true;
    if (rawValue === false || rawValue === 'false') return false;
    return rawValue;
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  // Backward-compatible aliases used by older clients.
  @IsUUID()
  @IsOptional()
  hubId?: string;

  @Transform(({ value, obj, key }) => {
    const rawValue = obj?.[key] ?? value;
    if (rawValue === true || rawValue === 'true') return true;
    if (rawValue === false || rawValue === 'false') return false;
    return rawValue;
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
