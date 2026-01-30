import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AdminAccount } from './admin-account.entity';
import { User } from '../../users/entities/user.entity';
import {
  AccountReferenceType,
  AccountTransactionType,
} from 'src/common/enums/account-type.enum';

@Entity('admin_account_statements')
export class AdminAccountStatement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  account_id: string;

  @ManyToOne(() => AdminAccount, (account) => account.statements)
  @JoinColumn({ name: 'account_id' })
  account: AdminAccount;

  @Column({ type: 'enum', enum: AccountTransactionType })
  type: AccountTransactionType; // CREDIT or DEBIT

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  credit_amount: number; // 0 if Debit

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  debit_amount: number; // 0 if Credit

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  balance_before: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  balance_after: number;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'enum', enum: AccountReferenceType })
  reference_type: AccountReferenceType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference_id: string | null; // e.g., Payout ID, Transfer ID

  @Column({ type: 'uuid', nullable: true })
  created_by_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @CreateDateColumn()
  created_at: Date;

  @CreateDateColumn()
  updated_at: Date;
}
