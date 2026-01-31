import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsEnum,
  Min,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { AccountTransactionType } from 'src/common/enums/account-type.enum';

export class ManualTransactionDto {
  @IsNotEmpty()
  @IsUUID()
  account_id: string;

  @IsNotEmpty()
  @IsEnum(AccountTransactionType)
  type: AccountTransactionType;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  reference_id?: string;
}
