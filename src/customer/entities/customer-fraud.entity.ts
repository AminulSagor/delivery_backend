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
import { Customer } from './customer.entity';
import { Merchant } from '../../merchant/entities/merchant.entity';
import { User } from '../../users/entities/user.entity';

export enum CustomerFraudStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REMOVED = 'REMOVED',
}

@Entity('customer_fraud_list')
@Index(['customer_id'])
@Index(['merchant_id'])
@Index(['status'])
export class CustomerFraud {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  customer_id!: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ type: 'uuid' })
  merchant_id!: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant!: Merchant;

  @Column({ type: 'text' })
  reason!: string;

  @Column({
    type: 'enum',
    enum: CustomerFraudStatus,
    default: CustomerFraudStatus.PENDING,
  })
  status!: CustomerFraudStatus;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by_admin_id!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_admin_id' })
  reviewedByAdmin!: User | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  admin_note!: string | null;

  @Column({ type: 'uuid', nullable: true })
  removed_by_merchant_id!: string | null;

  @ManyToOne(() => Merchant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'removed_by_merchant_id' })
  removedByMerchant!: Merchant | null;

  @Column({ type: 'timestamp', nullable: true })
  removed_at!: Date | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
