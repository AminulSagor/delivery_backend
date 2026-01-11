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

  // ===== WEIGHT CHARGES (Zone-based step calculation) =====
  
  /**
   * Weight step size in kg for calculating charges
   * - INSIDE_DHAKA: default 0.5 kg per step
   * - SUB_DHAKA: default 2.0 kg per step  
   * - OUTSIDE_DHAKA: default 1.0 kg per step
   * 
   * NOTE: free_weight_kg is FIXED at 0.5 kg for all zones
   * NOTE: charge_per_step is FIXED: 10 BDT for INSIDE_DHAKA, 20 BDT for others
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.5 })
  weight_step_kg: number;

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
