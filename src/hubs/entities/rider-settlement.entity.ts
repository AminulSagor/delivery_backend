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
import { Rider } from '../../riders/entities/rider.entity';
import { HubManager } from './hub-manager.entity';
import { Hub } from './hub.entity';
import { SettlementStatus } from '../../common/enums/settlement-status.enum';

@Entity('rider_settlements')
@Index(['rider_id', 'settled_at'])
@Index(['hub_id', 'settled_at'])
@Index(['settlement_status'])
export class RiderSettlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ===== RELATIONSHIPS =====
  @Column({ type: 'uuid' })
  rider_id: string;

  @ManyToOne(() => Rider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rider_id' })
  rider: Rider;

  @Column({ type: 'uuid' })
  hub_id: string;

  @ManyToOne(() => Hub, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hub_id' })
  hub: Hub;

  @Column({ type: 'uuid' })
  hub_manager_id: string;

  @ManyToOne(() => HubManager, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'hub_manager_id' })
  hubManager: HubManager;

  // ===== SETTLEMENT AMOUNTS =====
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_collected_amount: number; // Total COD collected by rider since last settlement

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  cash_received: number; // Actual cash handed over by rider

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discrepancy_amount: number; // Difference (cash_received - total_collected)

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  previous_due_amount: number; // Due amount carried forward from previous settlement

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  new_due_amount: number; // Updated due amount after this settlement

  // ===== DELIVERY BREAKDOWN =====
  @Column({ type: 'int', default: 0 })
  completed_deliveries: number; // Total deliveries completed since last settlement

  @Column({ type: 'int', default: 0 })
  delivered_count: number; // DELIVERED status

  @Column({ type: 'int', default: 0 })
  partial_delivery_count: number; // PARTIAL_DELIVERY status

  @Column({ type: 'int', default: 0 })
  exchange_count: number; // EXCHANGE status

  @Column({ type: 'int', default: 0 })
  paid_return_count: number; // PAID_RETURN status

  @Column({ type: 'int', default: 0 })
  returned_count: number; // RETURNED status

  // ===== SETTLEMENT STATUS =====
  @Column({
    type: 'enum',
    enum: SettlementStatus,
    default: SettlementStatus.PENDING,
  })
  settlement_status: SettlementStatus;

  // ===== SETTLEMENT PERIOD =====
  @Column({ type: 'timestamp', nullable: true })
  period_start: Date | null; // Start of settlement period (last settlement date or rider join date)

  @Column({ type: 'timestamp', nullable: true })
  period_end: Date | null; // End of settlement period (now)

  // ===== TIMESTAMPS =====
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  settled_at: Date; // When settlement was recorded

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

