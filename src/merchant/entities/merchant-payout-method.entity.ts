import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Merchant } from './merchant.entity';
import { User } from '../../users/entities/user.entity';
import { PayoutTransaction } from './payout-transaction.entity';
import { PayoutMethodType } from '../../common/enums/payout-method-type.enum';
import { PayoutMethodStatus } from '../../common/enums/payout-method-status.enum';
import { BkashAccountType, NagadAccountType } from '../../common/enums/account-type.enum';

@Entity('merchant_payout_methods')
@Index(['merchant_id', 'method_type'], { unique: true })
@Index(['merchant_id', 'is_default'])
export class MerchantPayoutMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ===== RELATIONSHIPS =====
  @Column({ type: 'uuid' })
  merchant_id: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  // ===== METHOD TYPE & STATUS =====
  @Column({
    type: 'enum',
    enum: PayoutMethodType,
  })
  method_type: PayoutMethodType;

  @Column({
    type: 'enum',
    enum: PayoutMethodStatus,
    default: PayoutMethodStatus.PENDING,
  })
  status: PayoutMethodStatus;

  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  // ===== BANK ACCOUNT DETAILS =====
  @Column({ type: 'varchar', length: 255, nullable: true })
  bank_name: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  branch_name: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  account_holder_name: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  account_number: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  routing_number: string | null;

  // ===== BKASH DETAILS =====
  @Column({ type: 'varchar', length: 20, nullable: true })
  bkash_number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bkash_account_holder_name: string | null;

  @Column({
    type: 'enum',
    enum: BkashAccountType,
    nullable: true,
  })
  bkash_account_type: BkashAccountType | null;

  // ===== NAGAD DETAILS =====
  @Column({ type: 'varchar', length: 20, nullable: true })
  nagad_number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nagad_account_holder_name: string | null;

  @Column({
    type: 'enum',
    enum: NagadAccountType,
    nullable: true,
  })
  nagad_account_type: NagadAccountType | null;

  // ===== VERIFICATION =====
  @Column({ type: 'timestamp', nullable: true })
  verified_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  verified_by: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'verified_by' })
  verifier: User | null;

  // ===== TRANSACTIONS =====
  @OneToMany(() => PayoutTransaction, (transaction) => transaction.payout_method)
  transactions: PayoutTransaction[];

  // ===== TIMESTAMPS =====
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

