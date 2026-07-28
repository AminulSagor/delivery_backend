import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Max,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SuggestCoverageAreaDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class SuggestAddressDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  fixedAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  subArea?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  thana?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  city?: string;
}
