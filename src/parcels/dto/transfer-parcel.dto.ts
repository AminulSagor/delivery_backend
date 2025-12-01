import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class TransferParcelDto {
  @IsString()
  @IsNotEmpty()
  destination_hub_id: string;

  @IsString()
  @IsOptional()
  transfer_notes?: string;
}
