import { IsOptional, IsString, MinLength } from 'class-validator';

export class SearchCoverageAreaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  area?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  division?: string;

  @IsOptional()
  @IsString()
  zone?: string;
}
