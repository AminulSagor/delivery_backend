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
import { Merchant } from './merchant.entity';
import { MerchantPayoutMethod } from './merchant-payout-method.entity';
import { User } from '../../users/entities/user.entity';
import { PayoutTransactionStatus } from '../../common/enums/payout-transaction-status.enum';

@Entity('payout_transactions')
@Index(['merchant_id'])
@Index(['status'])
@Index(['created_at'])
export class PayoutTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ===== RELATIONSHIPS =====
  @Column({ type: 'uuid' })
  merchant_id: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @Column({ type: 'uuid' })
  payout_method_id: string;

  @ManyToOne(() => MerchantPayoutMethod, (method) => method.transactions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'payout_method_id' })
  payout_method: MerchantPayoutMethod;

  // ===== TRANSACTION DETAILS =====
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  reference_number: string | null;

  @Column({
    type: 'enum',
    enum: PayoutTransactionStatus,
    default: PayoutTransactionStatus.PENDING,
  })
  status: PayoutTransactionStatus;

  // ===== NOTES =====
  @Column({ type: 'text', nullable: true })
  admin_notes: string | null;

  @Column({ type: 'text', nullable: true })
  failure_reason: string | null;

  // ===== TIMESTAMPS =====
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  initiated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  processed_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  // ===== INITIATED BY =====
  @Column({ type: 'uuid', nullable: true })
  initiated_by: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'initiated_by' })
  initiator: User | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

