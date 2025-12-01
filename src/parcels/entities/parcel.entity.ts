import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Merchant } from '../../merchant/entities/merchant.entity';
import { Store } from '../../stores/entities/store.entity';
import { CoverageArea } from '../../coverage-areas/entities/coverage-area.entity';
import { Customer } from '../../customer/entities/customer.entity';
import { PickupRequest } from '../../pickup-requests/entities/pickup-request.entity';
import { Rider } from '../../riders/entities/rider.entity';
import { Hub } from '../../hubs/entities/hub.entity';
import { ParcelType } from '../../common/enums/parcel-type.enum';
import { DeliveryType } from '../../common/enums/delivery-type.enum';
import { DeliveryProvider } from '../../common/enums/delivery-provider.enum';
import { ThirdPartyProvider } from '../../third-party-providers/entities/third-party-provider.entity';

export enum ParcelStatus {
  PENDING = 'PENDING',
  PICKED_UP = 'PICKED_UP',
  IN_HUB = 'IN_HUB',
  ASSIGNED_TO_RIDER = 'ASSIGNED_TO_RIDER',
  ASSIGNED_TO_THIRD_PARTY = 'ASSIGNED_TO_THIRD_PARTY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  OUT_FOR_PICKUP = 'OUT_FOR_PICKUP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  PARTIAL_DELIVERY = 'PARTIAL_DELIVERY',
  EXCHANGE = 'EXCHANGE',
  FAILED_DELIVERY = 'FAILED_DELIVERY',
  RETURNED_TO_HUB = 'RETURNED_TO_HUB',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
  PAID_RETURN = 'PAID_RETURN',
  RETURN_TO_MERCHANT = 'RETURN_TO_MERCHANT',
  DELIVERY_RESCHEDULED = 'DELIVERY_RESCHEDULED',
}

/**
 * Rider-selectable delivery outcome statuses
 * These are the statuses a rider can select when completing a delivery
 */
export const RIDER_DELIVERY_STATUSES = [
  ParcelStatus.DELIVERED,
  ParcelStatus.PARTIAL_DELIVERY,
  ParcelStatus.EXCHANGE,
  ParcelStatus.DELIVERY_RESCHEDULED,
  ParcelStatus.PAID_RETURN,
  ParcelStatus.RETURNED,
] as const;

export type RiderDeliveryStatus = typeof RIDER_DELIVERY_STATUSES[number];

/**
 * Statuses that always require a reason (regardless of amount match)
 */
export const REASON_REQUIRED_STATUSES = [
  ParcelStatus.PARTIAL_DELIVERY,
  ParcelStatus.EXCHANGE,
  ParcelStatus.DELIVERY_RESCHEDULED,
  ParcelStatus.PAID_RETURN,
  ParcelStatus.RETURNED,
] as const;

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  COD_COLLECTED = 'COD_COLLECTED',
}

@Entity('parcels')
export class Parcel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  // ===== MERCHANT & STORE INFORMATION =====
  @Column({ type: 'uuid' })
  merchant_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: User;

  @Column({ type: 'uuid', nullable: true })
  store_id: string | null;

  @ManyToOne(() => Store, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  // ===== PICKUP REQUEST =====
  @Column({ type: 'uuid', nullable: true })
  pickup_request_id: string | null;

  @ManyToOne(() => PickupRequest, (pickupRequest) => pickupRequest.parcels, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pickup_request_id' })
  pickupRequest: PickupRequest | null;

  // ===== TRACKING & IDENTIFICATION =====
  @Column({ type: 'varchar', length: 50, unique: true })
  tracking_number: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  merchant_order_id: string | null;

  // ===== PICKUP INFORMATION =====
  // Simplified: only pickup address
  @Column({ type: 'text' })
  pickup_address: string;

  // ===== DELIVERY INFORMATION =====
  @Column({ type: 'uuid', nullable: true })
  delivery_coverage_area_id: string | null;

  @ManyToOne(() => CoverageArea, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'delivery_coverage_area_id' })
  delivery_coverage_area: CoverageArea;

  @Column({ type: 'varchar', length: 255 })
  customer_name: string;

  @Column({ type: 'varchar', length: 20 })
  customer_phone: string;

  @Column({ type: 'text' })
  delivery_address: string;

  // ===== PARCEL DETAILS =====
  @Column({ type: 'varchar', length: 255, nullable: true })
  product_description: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  product_price: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  product_weight: number;

  @Column({ type: 'smallint', nullable: true })
  parcel_type: ParcelType | null;

  // ===== PRICING & CHARGES =====
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  delivery_charge: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  weight_charge: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  cod_charge: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_charge: number;

  @Column({ type: 'boolean', default: false })
  is_cod: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  cod_amount: number;

  // ===== STATUS & TRACKING =====
  @Column({
    type: 'enum',
    enum: ParcelStatus,
    default: ParcelStatus.PENDING,
  })
  status: ParcelStatus;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
  })
  payment_status: PaymentStatus;

  @Column({ type: 'smallint', default: 1 })
  delivery_type: DeliveryType;

  // ===== RIDER ASSIGNMENT =====
  @Column({ type: 'uuid', nullable: true })
  assigned_rider_id: string | null;

  @ManyToOne(() => Rider, (rider) => rider.assignedParcels, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_rider_id' })
  assignedRider: Rider | null;

  @Column({ type: 'timestamp', nullable: true })
  assigned_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  rider_accepted_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  out_for_delivery_at: Date | null;

  // ===== SPECIAL INSTRUCTIONS & NOTES =====
  @Column({ type: 'text', nullable: true })
  special_instructions: string | null;

  @Column({ type: 'text', nullable: true })
  admin_notes: string | null;

  @Column({ type: 'text', nullable: true })
  return_reason: string | null;

  // ===== HUB TRANSFER TRACKING =====
  @Column({ type: 'uuid', nullable: true })
  current_hub_id: string | null;

  @ManyToOne(() => Hub, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'current_hub_id' })
  currentHub: Hub | null;

  @Column({ type: 'uuid', nullable: true })
  origin_hub_id: string | null;

  @ManyToOne(() => Hub, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'origin_hub_id' })
  originHub: Hub | null;

  @Column({ type: 'uuid', nullable: true })
  destination_hub_id: string | null;

  @ManyToOne(() => Hub, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'destination_hub_id' })
  destinationHub: Hub | null;

  @Column({ type: 'boolean', default: false })
  is_inter_hub_transfer: boolean;

  @Column({ type: 'timestamp', nullable: true })
  transferred_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  received_at_destination_hub: Date | null;

  @Column({ type: 'text', nullable: true })
  transfer_notes: string | null;

  // ===== THIRD PARTY DELIVERY =====
  @Column({
    type: 'enum',
    enum: DeliveryProvider,
    default: DeliveryProvider.INTERNAL,
  })
  delivery_provider: DeliveryProvider;

  @Column({ type: 'uuid', nullable: true })
  third_party_provider_id: string | null;

  @ManyToOne(() => ThirdPartyProvider, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'third_party_provider_id' })
  thirdPartyProvider: ThirdPartyProvider | null;

  // ===== CARRYBEE SPECIFIC =====
  @Column({ type: 'varchar', length: 100, nullable: true })
  carrybee_consignment_id: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  carrybee_delivery_fee: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  carrybee_cod_fee: number | null;

  @Column({ type: 'timestamp', nullable: true })
  assigned_to_carrybee_at: Date | null;

  // Recipient/Delivery location for Carrybee
  @Column({ type: 'int', nullable: true })
  recipient_carrybee_city_id: number | null;

  @Column({ type: 'int', nullable: true })
  recipient_carrybee_zone_id: number | null;

  @Column({ type: 'int', nullable: true })
  recipient_carrybee_area_id: number | null;

  // ===== RETURN PARCEL TRACKING =====
  @Column({ type: 'uuid', nullable: true })
  original_parcel_id: string | null;

  @ManyToOne(() => Parcel, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'original_parcel_id' })
  originalParcel: Parcel | null;

  @Column({ type: 'boolean', default: false })
  is_return_parcel: boolean;

  // ===== TIMESTAMPS =====
  @Column({ type: 'timestamp', nullable: true })
  picked_up_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  delivered_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
