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
  address!: string;

  @IsOptional()
  @IsString()
  fixedAddress?: string;

  @IsOptional()
  @IsString()
  addressStatus?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  barikoiScore?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  subArea?: string;

  @IsOptional()
  @IsString()
  thana?: string;
}
