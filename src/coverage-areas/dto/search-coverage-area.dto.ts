import { IsOptional, IsString, MinLength } from 'class-validator';

export class SearchCoverageAreaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  area?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  division?: string;

  @IsOptional()
  @IsString()
  zone?: string;
}
