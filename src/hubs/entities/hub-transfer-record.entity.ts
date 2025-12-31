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
import { HubManager } from './hub-manager.entity';
import { Hub } from './hub.entity';
import { User } from '../../users/entities/user.entity';
import { TransferRecordStatus } from '../../common/enums/transfer-record-status.enum';

@Entity('hub_transfer_records')
@Index(['hub_manager_id', 'transfer_date'])
@Index(['hub_id', 'transfer_date'])
@Index(['status'])
@Index(['transfer_date'])
export class HubTransferRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ===== RELATIONSHIPS =====
  @Column({ type: 'uuid' })
  hub_manager_id: string;

  @ManyToOne(() => HubManager, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hub_manager_id' })
  hubManager: HubManager;

  @Column({ type: 'uuid' })
  hub_id: string;

  @ManyToOne(() => Hub, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hub_id' })
  hub: Hub;

  // ===== TRANSFER DETAILS =====
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  transferred_amount: number;

  // ===== ADMIN BANK ACCOUNT DETAILS =====
  @Column({ type: 'varchar', length: 255 })
  admin_bank_name: string;

  @Column({ type: 'varchar', length: 100 })
  admin_bank_account_number: string;

  @Column({ type: 'varchar', length: 255 })
  admin_account_holder_name: string;

  // ===== TRANSACTION REFERENCE =====
  @Column({ type: 'varchar', length: 255, nullable: true })
  transaction_reference_id: string | null;

  // ===== PROOF DOCUMENT =====
  @Column({ type: 'varchar', length: 500 })
  proof_file_url: string;

  @Column({ type: 'varchar', length: 10 })
  proof_file_type: string;

  @Column({ type: 'int' })
  proof_file_size: number;

  // ===== STATUS & APPROVAL =====
  @Column({
    type: 'enum',
    enum: TransferRecordStatus,
    default: TransferRecordStatus.PENDING,
  })
  status: TransferRecordStatus;

  // ===== ADMIN ACTIONS =====
  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: User;

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  admin_notes: string | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  // ===== HUB MANAGER NOTES =====
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // ===== TIMESTAMPS =====
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  transfer_date: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
