import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CollectCodDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  counted_amount: number; // The manual "Counted Amount" from hub manager
}
