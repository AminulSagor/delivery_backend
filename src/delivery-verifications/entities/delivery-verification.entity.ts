import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Parcel, ParcelStatus } from '../../parcels/entities/parcel.entity';
import { Rider } from '../../riders/entities/rider.entity';

export enum DeliveryVerificationStatus {
  PENDING = 'PENDING',
  OTP_SENT = 'OTP_SENT',
  OTP_VERIFIED = 'OTP_VERIFIED',
  OTP_FAILED = 'OTP_FAILED',
  COMPLETED = 'COMPLETED',
}

/**
 * Who receives the OTP for verification
 */
export enum OtpRecipientType {
  MERCHANT = 'MERCHANT',
  CUSTOMER = 'CUSTOMER',
}

@Entity('delivery_verifications')
export class DeliveryVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ===== RELATIONSHIPS =====
  @Column({ type: 'uuid', unique: true })
  parcel_id: string;

  @ManyToOne(() => Parcel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parcel_id' })
  parcel: Parcel;

  @Column({ type: 'uuid' })
  rider_id: string;

  @ManyToOne(() => Rider, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rider_id' })
  rider: Rider;

  // ===== SELECTED DELIVERY STATUS =====
  @Column({
    type: 'varchar',
    length: 50,
  })
  selected_status: ParcelStatus;

  // ===== COLLECTION DETAILS =====
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  expected_cod_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  collected_amount: number;

  // GENERATED column - auto-calculated by DB: collected_amount - expected_cod_amount
  @Column({ type: 'decimal', precision: 10, scale: 2, insert: false, update: false })
  amount_difference: number;

  // ===== DIFFERENCE HANDLING =====
  @Column({ type: 'boolean', default: false })
  has_amount_difference: boolean;

  @Column({ type: 'text', nullable: true })
  difference_reason: string | null;

  // ===== OTP VERIFICATION =====
  @Column({ type: 'boolean', default: true })
  requires_otp_verification: boolean;

  @Column({
    type: 'enum',
    enum: OtpRecipientType,
    default: OtpRecipientType.MERCHANT,
  })
  otp_recipient_type: OtpRecipientType;

  @Column({ type: 'varchar', length: 20, nullable: true })
  otp_sent_to_phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  otp_code: string | null; // Hashed OTP

  @Column({ type: 'timestamp', nullable: true })
  otp_sent_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  otp_verified_at: Date | null;

  @Column({ type: 'int', default: 0 })
  otp_attempts: number;

  @Column({ type: 'timestamp', nullable: true })
  otp_expires_at: Date | null;

  // ===== VERIFICATION STATUS =====
  @Column({
    type: 'enum',
    enum: DeliveryVerificationStatus,
    default: DeliveryVerificationStatus.PENDING,
  })
  verification_status: DeliveryVerificationStatus;

  // ===== AUDIT TRAIL =====
  @Column({ type: 'varchar', length: 20, nullable: true })
  merchant_phone_used: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  customer_phone_used: string | null;

  @Column({
    type: 'enum',
    enum: OtpRecipientType,
    nullable: true,
  })
  otp_verified_by: OtpRecipientType | null;

  @Column({ type: 'boolean', default: false })
  merchant_approved: boolean;

  @Column({ type: 'timestamp', nullable: true })
  merchant_approved_at: Date | null;

  // ===== TIMESTAMPS =====
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  delivery_attempted_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  delivery_completed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
