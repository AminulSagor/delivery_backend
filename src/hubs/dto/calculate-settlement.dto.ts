import { IsNumber, Min } from 'class-validator';

export class CalculateSettlementDto {
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Cash received must be a number with max 2 decimal places' },
  )
  @Min(0, { message: 'Cash received cannot be negative' })
  cash_received: number;
}

