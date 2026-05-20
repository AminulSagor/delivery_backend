import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Merchant } from '../../merchant/entities/merchant.entity';
import { User } from '../../users/entities/user.entity';

export enum AdvancePaymentStatus {
  PENDING_MERCHANT_APPROVAL = 'PENDING_MERCHANT_APPROVAL',
  MERCHANT_REVIEW_REQUESTED = 'MERCHANT_REVIEW_REQUESTED',
  APPROVED_BY_MERCHANT = 'APPROVED_BY_MERCHANT',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

@Entity('advance_payments')
export class AdvancePayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  invoice_id: string; // e.g., ADV-2024001

  @Column({ type: 'uuid' })
  merchant_id: string;

  @ManyToOne(() => Merchant)
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @Column({ type: 'uuid', nullable: true })
  created_by_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  // ===== MANUAL INPUT FIELDS =====
  @Column({ type: 'int', default: 0 })
  total_parcels: number; // Manual Entry

  @Column({ type: 'varchar', length: 50 })
  payment_method: string; // Manual Entry

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_collectable_amount: number; // Manual Entry

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  delivery_fee: number; // Manual Entry

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  cod_charge: number; // Manual Entry

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  previous_weight_charge: number; // Manual Entry

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  return_amount: number; // Manual Entry

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  update_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  hold_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  hold_pay: number;

  // ===== CALCULATED FIELD =====
  // Net = Collectable - (Delivery + COD + Weight + Return)
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  net_amount_paid: number;

  // ===== STATUS & WORKFLOW =====
  @Column({
    type: 'enum',
    enum: AdvancePaymentStatus,
    default: AdvancePaymentStatus.PENDING_MERCHANT_APPROVAL,
  })
  status: AdvancePaymentStatus;

  @Column({ type: 'text', nullable: true })
  merchant_review_note: string;

  @Column({ type: 'text', nullable: true })
  admin_note: string | null;

  @Column({ type: 'boolean', default: false })
  is_paid: boolean;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
