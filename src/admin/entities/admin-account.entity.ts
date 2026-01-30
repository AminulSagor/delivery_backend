import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { AccountProviderType } from '../../common/enums/account-type.enum';
import { AdminAccountStatement } from './admin-account-statement.entity';

@Entity('admin_accounts')
export class AdminAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  account_name: string; // e.g., "DBBL Corporate", "Main Bkash"

  @Column({ type: 'varchar', length: 50, unique: true })
  account_number: string;

  @Column({ type: 'varchar', length: 100 })
  account_holder_name: string;

  @Column({
    type: 'enum',
    enum: AccountProviderType,
    default: AccountProviderType.BANK,
  })
  provider_type: AccountProviderType;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  current_balance: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => AdminAccountStatement, (statement) => statement.account)
  statements: AdminAccountStatement[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
