import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateSmsPreferencesDto } from '../dto/update-sms-preferences.dto';
import {
  SMS_PREFERENCE_EVENT_LABELS,
  SmsPreference,
  SmsPreferenceEvent,
  SmsPreferenceRecipient,
} from '../entities/sms-preference.entity';

type SmsPreferenceItem = {
  id: string;
  event: SmsPreferenceEvent;
  label: string;
  enabled: boolean;
  updated_at: Date;
};

type SmsPreferenceSection = {
  recipient: SmsPreferenceRecipient;
  title: string;
  description: string;
  events: SmsPreferenceItem[];
};

@Injectable()
export class SmsPreferencesService {
  private readonly recipients = [
    SmsPreferenceRecipient.CUSTOMER,
    SmsPreferenceRecipient.MERCHANT,
  ];

  private readonly events = Object.values(SmsPreferenceEvent);

  constructor(
    @InjectRepository(SmsPreference)
    private readonly smsPreferenceRepository: Repository<SmsPreference>,
  ) {}

  async getPreferences(): Promise<{
    customer: SmsPreferenceSection;
    merchant: SmsPreferenceSection;
  }> {
    const preferences = await this.ensureDefaults();

    return {
      customer: this.buildSection(SmsPreferenceRecipient.CUSTOMER, preferences),
      merchant: this.buildSection(SmsPreferenceRecipient.MERCHANT, preferences),
    };
  }

  async updatePreferences(dto: UpdateSmsPreferencesDto): Promise<{
    customer: SmsPreferenceSection;
    merchant: SmsPreferenceSection;
  }> {
    await this.ensureDefaults();

    for (const item of dto.preferences) {
      await this.smsPreferenceRepository.upsert(
        {
          recipient: item.recipient,
          event: item.event,
          enabled: item.enabled,
        },
        ['recipient', 'event'],
      );
    }

    return this.getPreferences();
  }

  async isEnabled(
    recipient: SmsPreferenceRecipient,
    event: SmsPreferenceEvent,
  ): Promise<boolean> {
    const preference = await this.smsPreferenceRepository.findOne({
      where: { recipient, event },
      select: ['enabled'],
    });

    return preference?.enabled ?? true;
  }

  private async ensureDefaults(): Promise<SmsPreference[]> {
    const existing = await this.smsPreferenceRepository.find();
    const existingKeys = new Set(
      existing.map((item) => this.preferenceKey(item.recipient, item.event)),
    );

    const missing: Array<Partial<SmsPreference>> = [];
    for (const recipient of this.recipients) {
      for (const event of this.events) {
        if (!existingKeys.has(this.preferenceKey(recipient, event))) {
          missing.push({ recipient, event, enabled: true });
        }
      }
    }

    if (missing.length > 0) {
      await this.smsPreferenceRepository.insert(missing);
      return this.smsPreferenceRepository.find();
    }

    return existing;
  }

  private buildSection(
    recipient: SmsPreferenceRecipient,
    preferences: SmsPreference[],
  ): SmsPreferenceSection {
    const preferencesByEvent = new Map(
      preferences
        .filter((item) => item.recipient === recipient)
        .map((item) => [item.event, item]),
    );

    return {
      recipient,
      title:
        recipient === SmsPreferenceRecipient.CUSTOMER
          ? 'Parcel Status SMS to Customer'
          : 'Parcel Status SMS to Merchant',
      description:
        recipient === SmsPreferenceRecipient.CUSTOMER
          ? 'Customer will receive parcel event change SMS'
          : 'Merchant will receive parcel event change SMS',
      events: this.events.map((event) => {
        const preference = preferencesByEvent.get(event);

        return {
          id: preference?.id ?? '',
          event,
          label: SMS_PREFERENCE_EVENT_LABELS[event],
          enabled: preference?.enabled ?? true,
          updated_at: preference?.updated_at ?? new Date(0),
        };
      }),
    };
  }

  private preferenceKey(
    recipient: SmsPreferenceRecipient,
    event: SmsPreferenceEvent,
  ): string {
    return `${recipient}:${event}`;
  }
}
