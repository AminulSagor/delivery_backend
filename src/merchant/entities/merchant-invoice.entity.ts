import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MerchantPayoutMethod } from './merchant-payout-method.entity';
import { Merchant } from './merchant.entity';

export enum InvoiceStatus {
  UNPAID = 'UNPAID',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
}

@Entity('merchant_invoices')
@Index(['merchant_id', 'created_at'])
@Index(['invoice_status'])
@Index(['invoice_no'], { unique: true })
export class MerchantInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ===== INVOICE DETAILS =====
  @Column({ type: 'varchar', length: 50, unique: true })
  invoice_no: string;

  // Transaction ID (for display purposes)
  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  transaction_id: string | null;

  @Column({ type: 'uuid' })
  merchant_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: User;

  // Merchant Profile reference (for getting address, etc.)
  @Column({ type: 'uuid', nullable: true })
  merchant_profile_id: string | null;

  @ManyToOne(() => Merchant, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'merchant_profile_id' })
  merchantProfile: Merchant | null;

  // ===== PAYMENT METHOD =====
  @Column({ type: 'uuid', nullable: true })
  payout_method_id: string | null;

  @ManyToOne(() => MerchantPayoutMethod, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payout_method_id' })
  payoutMethod: MerchantPayoutMethod | null;

  // ===== PARCEL SUMMARY =====
  @Column({ type: 'int', default: 0 })
  total_parcels: number;

  @Column({ type: 'int', default: 0 })
  delivered_count: number;

  @Column({ type: 'int', default: 0 })
  partial_delivery_count: number;

  @Column({ type: 'int', default: 0 })
  returned_count: number;

  @Column({ type: 'int', default: 0 })
  paid_return_count: number;

  // ===== FINANCIAL SUMMARY =====
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_cod_amount: number; // Expected COD

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_cod_collected: number; // Actually collected

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_delivery_charges: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_return_charges: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  payable_amount: number; // Net amount to pay merchant

  // ===== STATUS =====
  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.UNPAID,
  })
  invoice_status: InvoiceStatus;

  // ===== PAYMENT TRACKING =====
  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  paid_by: string | null; // Admin user ID

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'paid_by' })
  paidByUser: User | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  payment_reference: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // ===== TIMESTAMPS =====
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

