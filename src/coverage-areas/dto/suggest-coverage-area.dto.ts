import { IsNotEmpty, IsOptional, IsString, MinLength, Max, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SuggestCoverageAreaDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

