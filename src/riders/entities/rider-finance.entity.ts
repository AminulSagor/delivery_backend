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
import { Rider } from './rider.entity';

@Entity('rider_finances')
@Index(['rider_id'], { unique: true })
export class RiderFinance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ===== RIDER REFERENCE =====
  @Column({ type: 'uuid', unique: true })
  rider_id: string;

  @OneToOne(() => Rider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rider_id' })
  rider: Rider;

  // ===== BALANCE FIELDS =====
  /**
   * Current operational cash in hand (Cash collected - Cash Settled)
   * This represents the amount the rider currently owes to the Hub/Company
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  current_balance: number;

  /**
   * Total COD collected from customers (lifetime)
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_collected_amount: number;

  /**
   * Total amount settled/deposited to Hub (lifetime)
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_deposited_amount: number;

  /**
   * Total commission earned (lifetime)
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_earnings: number;

  /**
   * Pending balance (Optional: for future use if needed)
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  pending_balance: number;

  // ===== LAST ACTIVITY =====
  @Column({ type: 'timestamp', nullable: true })
  last_settlement_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  last_collection_at: Date | null;

  // ===== TIMESTAMPS =====
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
