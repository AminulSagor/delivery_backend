import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MerchantFinance } from './merchant-finance.entity';
import {
  FinanceTransactionType,
  FinanceReferenceType,
} from '../../common/enums/finance-transaction-type.enum';

@Entity('merchant_finance_transactions')
@Index(['merchant_id', 'created_at'])
@Index(['reference_type', 'reference_id'])
@Index(['transaction_type'])
@Index(['created_at'])
export class MerchantFinanceTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ===== MERCHANT REFERENCE =====
  @Column({ type: 'uuid' })
  merchant_id: string;

  @ManyToOne(() => MerchantFinance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id', referencedColumnName: 'merchant_id' })
  merchantFinance: MerchantFinance;

  // ===== TRANSACTION DETAILS =====
  @Column({
    type: 'enum',
    enum: FinanceTransactionType,
  })
  transaction_type: FinanceTransactionType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  /**
   * Balance after this transaction
   */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  balance_after: number;

  /**
   * Previous balance before this transaction
   */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  balance_before: number;

  // ===== REFERENCE =====
  @Column({
    type: 'enum',
    enum: FinanceReferenceType,
  })
  reference_type: FinanceReferenceType;

  /**
   * ID of the referenced entity (parcel_id, invoice_id, etc.)
   */
  @Column({ type: 'uuid', nullable: true })
  reference_id: string | null;

  /**
   * Secondary reference (e.g., tracking number for parcels)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  reference_code: string | null;

  // ===== DESCRIPTION =====
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // ===== BREAKDOWN (for complex transactions) =====
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  cod_amount: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  delivery_charge: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  return_charge: number | null;

  // ===== CREATED BY =====
  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  // ===== METADATA =====
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  // ===== TIMESTAMP =====
  @CreateDateColumn()
  created_at: Date;
}

