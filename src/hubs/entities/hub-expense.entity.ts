import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { HubManager } from './hub-manager.entity';
import { Hub } from './hub.entity';
import { TransferRecordStatus } from 'src/common/enums/transfer-record-status.enum';
import { User } from 'src/users/entities/user.entity';

export enum ExpenseCategory {
  OFFICE_RENT = 'OFFICE_RENT',
  OFFICE_SUPPLY = 'OFFICE_SUPPLY',
  UTILITIES = 'UTILITIES',
  STATIONARY = 'STATIONARY',
  MAINTENANCE = 'MAINTENANCE',
  SALARY = 'SALARY',
  OTHER = 'OTHER',
}

@Entity('hub_expenses')
export class HubExpense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  hub_id: string;

  @ManyToOne(() => Hub)
  @JoinColumn({ name: 'hub_id' })
  hub: Hub;

  @Column({ type: 'uuid' })
  hub_manager_id: string;

  @ManyToOne(() => HubManager)
  @JoinColumn({ name: 'hub_manager_id' })
  hubManager: HubManager;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: ExpenseCategory })
  category: ExpenseCategory;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', nullable: true })
  proof_file_url: string; // S3 URL

  @Column({
    type: 'enum',
    enum: TransferRecordStatus, // Reuse PENDING/APPROVED/DECLINED
    default: TransferRecordStatus.IN_REVIEW,
  })
  status: TransferRecordStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: User;

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
