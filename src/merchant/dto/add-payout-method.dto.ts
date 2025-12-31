import {
  IsEnum,
  IsString,
  IsOptional,
  ValidateIf,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { PayoutMethodType } from '../../common/enums/payout-method-type.enum';
import { BkashAccountType, NagadAccountType } from '../../common/enums/account-type.enum';

export class AddPayoutMethodDto {
  @IsEnum(PayoutMethodType)
  method_type: PayoutMethodType;

  // Bank Account fields
  @ValidateIf((o) => o.method_type === PayoutMethodType.BANK_ACCOUNT)
  @IsNotEmpty({ message: 'Bank name is required for bank account' })
  @IsString()
  bank_name?: string;

  @ValidateIf((o) => o.method_type === PayoutMethodType.BANK_ACCOUNT)
  @IsNotEmpty({ message: 'Branch name is required for bank account' })
  @IsString()
  branch_name?: string;

  @ValidateIf((o) => o.method_type === PayoutMethodType.BANK_ACCOUNT)
  @IsNotEmpty({ message: 'Account holder name is required for bank account' })
  @IsString()
  account_holder_name?: string;

  @ValidateIf((o) => o.method_type === PayoutMethodType.BANK_ACCOUNT)
  @IsNotEmpty({ message: 'Account number is required for bank account' })
  @IsString()
  account_number?: string;

  @ValidateIf((o) => o.method_type === PayoutMethodType.BANK_ACCOUNT)
  @IsNotEmpty({ message: 'Routing number is required for bank account' })
  @IsString()
  routing_number?: string;

  // bKash fields
  @ValidateIf((o) => o.method_type === PayoutMethodType.BKASH)
  @IsNotEmpty({ message: 'bKash number is required' })
  @Matches(/^01[3-9]\d{8}$/, { message: 'Invalid bKash number format' })
  bkash_number?: string;

  @ValidateIf((o) => o.method_type === PayoutMethodType.BKASH)
  @IsNotEmpty({ message: 'bKash account holder name is required' })
  @IsString()
  bkash_account_holder_name?: string;

  @ValidateIf((o) => o.method_type === PayoutMethodType.BKASH)
  @IsNotEmpty({ message: 'bKash account type is required' })
  @IsEnum(BkashAccountType)
  bkash_account_type?: BkashAccountType;

  // Nagad fields
  @ValidateIf((o) => o.method_type === PayoutMethodType.NAGAD)
  @IsNotEmpty({ message: 'Nagad number is required' })
  @Matches(/^01[3-9]\d{8}$/, { message: 'Invalid Nagad number format' })
  nagad_number?: string;

  @ValidateIf((o) => o.method_type === PayoutMethodType.NAGAD)
  @IsNotEmpty({ message: 'Nagad account holder name is required' })
  @IsString()
  nagad_account_holder_name?: string;

  @ValidateIf((o) => o.method_type === PayoutMethodType.NAGAD)
  @IsNotEmpty({ message: 'Nagad account type is required' })
  @IsEnum(NagadAccountType)
  nagad_account_type?: NagadAccountType;
}

