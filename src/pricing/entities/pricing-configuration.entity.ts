import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from '../../stores/entities/store.entity';
import { PricingZone } from '../../common/enums/pricing-zone.enum';

@Entity('pricing_configurations')
export class PricingConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ===== STORE RELATIONSHIP =====
  @Column({ type: 'uuid' })
  store_id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  // ===== PRICING ZONE =====
  @Column({
    type: 'enum',
    enum: PricingZone,
  })
  zone: PricingZone; // INSIDE_DHAKA, OUTSIDE_DHAKA, SUB_DHAKA

  // ===== DELIVERY CHARGES =====
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  delivery_charge: number; // Base delivery charge for this zone

  // ===== WEIGHT CHARGES =====
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  weight_charge_per_kg: number; // Charge per kg

  // ===== COD CHARGES =====
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  cod_percentage: number; // Percentage of COD amount (e.g., 1.00 for 1%)

  // ===== DISCOUNT =====
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  discount_percentage: number | null; // Discount percentage (e.g., 10.00 for 10% off)

  // ===== TIME VALIDITY =====
  @Column({ type: 'timestamp', nullable: true })
  start_date: Date | null; // When this pricing becomes active

  @Column({ type: 'timestamp', nullable: true })
  end_date: Date | null; // When this pricing expires (null = no expiry)

  // ===== TIMESTAMPS =====
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
