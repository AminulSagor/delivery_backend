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
import { Staff } from './staff.entity';
import { PayoutTransaction } from '../../merchant/entities/payout-transaction.entity';
import { PayoutMethodType } from '../../common/enums/payout-method-type.enum';
import { PayoutMethodStatus } from '../../common/enums/payout-method-status.enum';
import { BkashAccountType, NagadAccountType } from '../../common/enums/account-type.enum';

@Entity('staff_payout_methods')
@Index(['staff_id', 'method_type'])
@Index(['staff_id', 'is_default'])
@Index(['staff_id', 'is_active'])
export class StaffPayoutMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  staff_id: string;

  @ManyToOne(() => Staff, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staff_id' })
  staff: Staff;

  @Column({
    type: 'enum',
    enum: PayoutMethodType,
  })
  method_type: PayoutMethodType;

  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({
    type: 'enum',
    enum: PayoutMethodStatus,
    default: PayoutMethodStatus.PENDING,
  })
  status: PayoutMethodStatus;

  // Bank account fields
  @Column({ type: 'varchar', length: 255, nullable: true })
  bank_name: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  district: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  branch_name: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  account_holder_name: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  account_number: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  routing_number: string | null;

  // bKash
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

  // Nagad
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

  @OneToMany(() => PayoutTransaction, (tx) => tx.payout_method)
  transactions: PayoutTransaction[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
