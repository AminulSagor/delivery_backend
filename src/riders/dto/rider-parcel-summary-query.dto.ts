import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum RiderParcelSummaryType {
  DELIVERED = 'DELIVERED',
  RETURNED = 'RETURNED',
}

export class RiderParcelSummaryQueryDto extends PaginationDto {
  @IsEnum(RiderParcelSummaryType)
  type: RiderParcelSummaryType;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid start date' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid end date' })
  endDate?: string;
}
