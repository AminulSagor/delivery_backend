import { ParcelStatus } from './entities/parcel.entity';

export enum ParcelTrackingEventType {
  PARCEL_CREATED = 'PARCEL_CREATED',
  PARCEL_DETAILS_UPDATED = 'PARCEL_DETAILS_UPDATED',
  PICKUP_REQUEST_LINKED = 'PICKUP_REQUEST_LINKED',
  PICKED_UP = 'PICKED_UP',
  HUB_RECEIVED = 'HUB_RECEIVED',
  HUB_TRANSFER_STARTED = 'HUB_TRANSFER_STARTED',
  HUB_TRANSFER_RECEIVED = 'HUB_TRANSFER_RECEIVED',
  HUB_CHANGED = 'HUB_CHANGED',
  RIDER_ASSIGNED = 'RIDER_ASSIGNED',
  RIDER_TRANSFERRED = 'RIDER_TRANSFERRED',
  RIDER_UNASSIGNED = 'RIDER_UNASSIGNED',
  RIDER_ACCEPTED = 'RIDER_ACCEPTED',
  THIRD_PARTY_ASSIGNED = 'THIRD_PARTY_ASSIGNED',
  OUT_FOR_PICKUP = 'OUT_FOR_PICKUP',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERY_COMPLETED = 'DELIVERY_COMPLETED',
  PARTIAL_DELIVERY = 'PARTIAL_DELIVERY',
  EXCHANGE_COMPLETED = 'EXCHANGE_COMPLETED',
  DELIVERY_FAILED = 'DELIVERY_FAILED',
  DELIVERY_RESCHEDULED = 'DELIVERY_RESCHEDULED',
  RETURN_INITIATED = 'RETURN_INITIATED',
  PAID_RETURN_INITIATED = 'PAID_RETURN_INITIATED',
  RETURNED_TO_HUB = 'RETURNED_TO_HUB',
  RETURN_TO_MERCHANT = 'RETURN_TO_MERCHANT',
  RETURN_PARCEL_CREATED = 'RETURN_PARCEL_CREATED',
  REDELIVERY_PREPARED = 'REDELIVERY_PREPARED',
  ISSUE_REPORTED = 'ISSUE_REPORTED',
  ISSUE_RESOLVED = 'ISSUE_RESOLVED',
  ISSUE_REOPENED = 'ISSUE_REOPENED',
  ISSUE_CLEARED = 'ISSUE_CLEARED',
  CANCELLED = 'CANCELLED',
  STATUS_CHANGED = 'STATUS_CHANGED',
}

export enum ParcelTrackingActorType {
  MERCHANT = 'MERCHANT',
  HUB = 'HUB',
  RIDER = 'RIDER',
  ADMIN = 'ADMIN',
  THIRD_PARTY = 'THIRD_PARTY',
  CARRYBEE = 'CARRYBEE',
  SYSTEM = 'SYSTEM',
}

export interface ParcelTrackingContext {
  actor_type?: ParcelTrackingActorType;
  actor_id?: string | null;
  actor_name?: string | null;
  source?: string;
  event_type?: ParcelTrackingEventType;
  title?: string;
  description?: string | null;
  is_public?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface ParcelTrackingEventDraft {
  event_type: ParcelTrackingEventType;
  title: string;
  description?: string | null;
  from_status?: ParcelStatus | null;
  to_status?: ParcelStatus | null;
  actor_type?: ParcelTrackingActorType;
  actor_id?: string | null;
  actor_name?: string | null;
  source?: string;
  hub_id?: string | null;
  hub_name?: string | null;
  from_hub_id?: string | null;
  from_hub_name?: string | null;
  to_hub_id?: string | null;
  to_hub_name?: string | null;
  rider_id?: string | null;
  rider_name?: string | null;
  related_parcel_id?: string | null;
  related_tracking_number?: string | null;
  location?: string | null;
  metadata?: Record<string, unknown> | null;
  is_public?: boolean;
  occurred_at?: Date;
  dedupe_key?: string | null;
}

export const PARCEL_STATUS_EVENT: Partial<
  Record<
    ParcelStatus,
    { type: ParcelTrackingEventType; title: string; description: string }
  >
> = {
  [ParcelStatus.PENDING]: {
    type: ParcelTrackingEventType.STATUS_CHANGED,
    title: 'Parcel pending',
    description: 'The parcel is waiting to enter the delivery network.',
  },
  [ParcelStatus.PICKED_UP]: {
    type: ParcelTrackingEventType.PICKED_UP,
    title: 'Parcel picked up',
    description: 'The parcel was collected for processing.',
  },
  [ParcelStatus.IN_HUB]: {
    type: ParcelTrackingEventType.HUB_RECEIVED,
    title: 'Received at hub',
    description: 'The parcel was received and is being processed at a hub.',
  },
  [ParcelStatus.ASSIGNED_TO_RIDER]: {
    type: ParcelTrackingEventType.RIDER_ASSIGNED,
    title: 'Assigned to rider',
    description: 'The parcel was assigned to a delivery rider.',
  },
  [ParcelStatus.ASSIGNED_TO_THIRD_PARTY]: {
    type: ParcelTrackingEventType.THIRD_PARTY_ASSIGNED,
    title: 'Assigned to delivery partner',
    description: 'The parcel was handed to a third-party delivery partner.',
  },
  [ParcelStatus.OUT_FOR_PICKUP]: {
    type: ParcelTrackingEventType.OUT_FOR_PICKUP,
    title: 'Out for pickup',
    description: 'A rider is on the way to collect the parcel.',
  },
  [ParcelStatus.IN_TRANSIT]: {
    type: ParcelTrackingEventType.STATUS_CHANGED,
    title: 'Parcel in transit',
    description: 'The parcel is moving through the delivery network.',
  },
  [ParcelStatus.OUT_FOR_DELIVERY]: {
    type: ParcelTrackingEventType.OUT_FOR_DELIVERY,
    title: 'Out for delivery',
    description: 'The parcel is on the way to the recipient.',
  },
  [ParcelStatus.DELIVERED]: {
    type: ParcelTrackingEventType.DELIVERY_COMPLETED,
    title: 'Delivered',
    description: 'The parcel was delivered successfully.',
  },
  [ParcelStatus.PARTIAL_DELIVERY]: {
    type: ParcelTrackingEventType.PARTIAL_DELIVERY,
    title: 'Partially delivered',
    description: 'The delivery was completed with a partial delivery outcome.',
  },
  [ParcelStatus.EXCHANGE]: {
    type: ParcelTrackingEventType.EXCHANGE_COMPLETED,
    title: 'Exchange completed',
    description: 'The parcel exchange was completed.',
  },
  [ParcelStatus.FAILED_DELIVERY]: {
    type: ParcelTrackingEventType.DELIVERY_FAILED,
    title: 'Delivery attempt failed',
    description: 'The parcel could not be delivered on this attempt.',
  },
  [ParcelStatus.DELIVERY_RESCHEDULED]: {
    type: ParcelTrackingEventType.DELIVERY_RESCHEDULED,
    title: 'Delivery rescheduled',
    description: 'The parcel was scheduled for another delivery attempt.',
  },
  [ParcelStatus.RETURNED]: {
    type: ParcelTrackingEventType.RETURN_INITIATED,
    title: 'Return initiated',
    description: 'The parcel is being returned after the delivery attempt.',
  },
  [ParcelStatus.PAID_RETURN]: {
    type: ParcelTrackingEventType.PAID_RETURN_INITIATED,
    title: 'Paid return initiated',
    description: 'A paid return was confirmed for the parcel.',
  },
  [ParcelStatus.RETURNED_TO_HUB]: {
    type: ParcelTrackingEventType.RETURNED_TO_HUB,
    title: 'Returned to hub',
    description: 'The parcel was returned to the hub for the next action.',
  },
  [ParcelStatus.RETURN_TO_MERCHANT]: {
    type: ParcelTrackingEventType.RETURN_TO_MERCHANT,
    title: 'Returning to merchant',
    description: 'The parcel is being routed back to the merchant.',
  },
  [ParcelStatus.CANCELLED]: {
    type: ParcelTrackingEventType.CANCELLED,
    title: 'Parcel cancelled',
    description: 'The parcel delivery was cancelled.',
  },
};
