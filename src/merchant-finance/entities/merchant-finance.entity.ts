import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('merchant_finances')
@Index(['merchant_id'], { unique: true })
export class MerchantFinance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ===== MERCHANT REFERENCE =====
  @Column({ type: 'uuid', unique: true })
  merchant_id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: User;

  // ===== BALANCE FIELDS =====
  /**
   * Current available balance (can withdraw)
   * Updated in real-time with each transaction
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  current_balance: number;

  /**
   * Pending balance (parcels delivered but not yet settled)
   * Money in transit - will become available after settlement
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  pending_balance: number;

  /**
   * Amount in invoices waiting to be paid
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  invoiced_balance: number;

  /**
   * Amount currently being processed for payment
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  processing_balance: number;

  /**
   * Held/frozen amount (disputes, issues)
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  hold_amount: number;

  // ===== LIFETIME STATISTICS =====
  /**
   * Total amount earned (lifetime)
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_earned: number;

  /**
   * Total amount withdrawn (lifetime)
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_withdrawn: number;

  /**
   * Total delivery charges deducted (lifetime)
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_delivery_charges: number;

  /**
   * Total return charges deducted (lifetime)
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_return_charges: number;

  /**
   * Total COD collected (lifetime)
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_cod_collected: number;

  // ===== PARCEL STATISTICS =====
  @Column({ type: 'int', default: 0 })
  total_parcels_delivered: number;

  @Column({ type: 'int', default: 0 })
  total_parcels_returned: number;

  // ===== CREDIT LIMIT (Optional) =====
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  credit_limit: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  credit_used: number;

  // ===== LAST ACTIVITY =====
  @Column({ type: 'timestamp', nullable: true })
  last_transaction_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  last_withdrawal_at: Date | null;

  // ===== TIMESTAMPS =====
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

