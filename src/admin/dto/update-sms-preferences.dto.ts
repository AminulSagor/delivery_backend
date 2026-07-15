import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  SmsPreferenceEvent,
  SmsPreferenceRecipient,
} from '../entities/sms-preference.entity';

export class UpdateSmsPreferenceItemDto {
  @IsEnum(SmsPreferenceRecipient)
  recipient: SmsPreferenceRecipient;

  @IsEnum(SmsPreferenceEvent)
  event: SmsPreferenceEvent;

  @IsBoolean()
  enabled: boolean;
}

export class UpdateSmsPreferencesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateSmsPreferenceItemDto)
  preferences: UpdateSmsPreferenceItemDto[];
}
