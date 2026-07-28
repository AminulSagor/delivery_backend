import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SmsPreferenceRecipient {
  CUSTOMER = 'CUSTOMER',
  MERCHANT = 'MERCHANT',
}

export enum SmsPreferenceEvent {
  PARCEL_CREATED = 'PARCEL_CREATED',
  PICKUP_MAN_ASSIGNED = 'PICKUP_MAN_ASSIGNED',
  PARCEL_PICKUP_RESCHEDULED = 'PARCEL_PICKUP_RESCHEDULED',
  PARCEL_RECEIVED_BY_PICKUP_MAN = 'PARCEL_RECEIVED_BY_PICKUP_MAN',
  PARCEL_RECEIVED_TO_BRANCH = 'PARCEL_RECEIVED_TO_BRANCH',
  PARCEL_TRANSFERRED_TO_BRANCH_ASSIGNED = 'PARCEL_TRANSFERRED_TO_BRANCH_ASSIGNED',
  PARCEL_RECEIVED_BY_BRANCH = 'PARCEL_RECEIVED_BY_BRANCH',
  DELIVERY_MAN_ASSIGNED = 'DELIVERY_MAN_ASSIGNED',
  PARCEL_DELIVERY_RESCHEDULED = 'PARCEL_DELIVERY_RESCHEDULED',
  SUCCESSFULLY_DELIVERED_TO_CUSTOMER = 'SUCCESSFULLY_DELIVERED_TO_CUSTOMER',
  PARCEL_RETURN_TO_BRANCH = 'PARCEL_RETURN_TO_BRANCH',
  PARCEL_RETURN_ASSIGN_TO_MERCHANT = 'PARCEL_RETURN_ASSIGN_TO_MERCHANT',
  PARCEL_RETURNED_TO_MERCHANT = 'PARCEL_RETURNED_TO_MERCHANT',
  PARCEL_CANCELLED = 'PARCEL_CANCELLED',
}

export const SMS_PREFERENCE_EVENT_LABELS: Record<SmsPreferenceEvent, string> = {
  [SmsPreferenceEvent.PARCEL_CREATED]: 'Parcel Created',
  [SmsPreferenceEvent.PICKUP_MAN_ASSIGNED]: 'Pickup Man Assigned',
  [SmsPreferenceEvent.PARCEL_PICKUP_RESCHEDULED]: 'Parcel Pickup Re-scheduled',
  [SmsPreferenceEvent.PARCEL_RECEIVED_BY_PICKUP_MAN]:
    'Parcel Received By Pickup Man',
  [SmsPreferenceEvent.PARCEL_RECEIVED_TO_BRANCH]: 'Parcel Received To Branch',
  [SmsPreferenceEvent.PARCEL_TRANSFERRED_TO_BRANCH_ASSIGNED]:
    'Parcel Transferred To Branch Assigned',
  [SmsPreferenceEvent.PARCEL_RECEIVED_BY_BRANCH]: 'Parcel Received By Branch',
  [SmsPreferenceEvent.DELIVERY_MAN_ASSIGNED]: 'Delivery Man Assigned',
  [SmsPreferenceEvent.PARCEL_DELIVERY_RESCHEDULED]:
    'Parcel Delivery Re-scheduled',
  [SmsPreferenceEvent.SUCCESSFULLY_DELIVERED_TO_CUSTOMER]:
    'Successfully Delivered To Customer',
  [SmsPreferenceEvent.PARCEL_RETURN_TO_BRANCH]: 'Parcel Return To Branch',
  [SmsPreferenceEvent.PARCEL_RETURN_ASSIGN_TO_MERCHANT]:
    'Parcel Return Assign To Merchant',
  [SmsPreferenceEvent.PARCEL_RETURNED_TO_MERCHANT]:
    'Parcel Returned To Merchant',
  [SmsPreferenceEvent.PARCEL_CANCELLED]: 'Parcel Cancelled',
};

@Entity('sms_preferences')
@Index(['recipient', 'event'], { unique: true })
export class SmsPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: SmsPreferenceRecipient,
  })
  recipient: SmsPreferenceRecipient;

  @Column({
    type: 'enum',
    enum: SmsPreferenceEvent,
  })
  event: SmsPreferenceEvent;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
