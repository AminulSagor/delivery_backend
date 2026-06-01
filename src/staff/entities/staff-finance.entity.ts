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
import { Staff } from './staff.entity';

@Entity('staff_finances')
@Index(['staff_id'], { unique: true })
export class StaffFinance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ===== STAFF REFERENCE =====
  @Column({ type: 'uuid', unique: true })
  staff_id: string;

  @OneToOne(() => Staff, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staff_id' })
  staff: Staff;

  // ===== BALANCE FIELDS =====
  /**
   * Total amount paid to staff (cumulative from all completed payouts)
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_paid_amount: number;

  /**
   * Remaining balance / salary pending
   * (Calculated from fixed_salary + modifiers - total_paid_amount)
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  remaining_balance: number;

  // ===== LAST ACTIVITY =====
  @Column({ type: 'timestamp', nullable: true })
  last_payout_at: Date | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  last_payout_amount: number | null;

  // ===== TIMESTAMPS =====
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
