import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CodStatus, ParcelStatus } from '../../parcels/entities/parcel.entity';

export class HubActionCorrectionDto {
  @IsUUID()
  parcel_id: string;

  @IsEnum(ParcelStatus)
  action_status: ParcelStatus;

  @IsOptional()
  @IsEnum(CodStatus)
  cod_status?: CodStatus;
}

export class CollectCodDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  counted_amount: number; // The manual "Counted Amount" from hub manager

  /** Selected rows. Required so confirmation can never clear unrelated parcels. */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  parcel_ids: string[];

  /** Optional final status corrections applied before confirmation. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HubActionCorrectionDto)
  corrections?: HubActionCorrectionDto[];
}
