import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Store } from '../../stores/entities/store.entity';
import { PricingZone } from '../../common/enums/pricing-zone.enum';

export enum ReturnStatus {
  PARTIAL_DELIVERY = 'PARTIAL_DELIVERY',
  EXCHANGE = 'EXCHANGE',
  RETURNED = 'RETURNED',
  PAID_RETURN = 'PAID_RETURN',
}

@Entity('return_charge_configurations')
@Unique(['store_id', 'return_status', 'zone'])
@Index(['store_id'])
@Index(['return_status'])
export class ReturnChargeConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ===== STORE RELATIONSHIP =====
  @Column({ type: 'uuid' })
  store_id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  // ===== RETURN STATUS =====
  @Column({
    type: 'enum',
    enum: ReturnStatus,
  })
  return_status: ReturnStatus;

  // ===== PRICING ZONE =====
  @Column({
    type: 'enum',
    enum: PricingZone,
  })
  zone: PricingZone;

  // ===== RETURN CHARGES =====
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  return_delivery_charge: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  return_weight_charge_per_kg: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  return_cod_percentage: number; // If applicable

  // ===== DISCOUNT =====
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  discount_percentage: number | null;

  // ===== TIME VALIDITY =====
  @Column({ type: 'timestamp', nullable: true })
  start_date: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  end_date: Date | null;

  // ===== TIMESTAMPS =====
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

