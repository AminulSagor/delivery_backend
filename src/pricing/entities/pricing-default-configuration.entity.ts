import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PricingZone } from '../../common/enums/pricing-zone.enum';

@Entity('pricing_default_configurations')
@Unique(['zone'])
export class PricingDefaultConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: PricingZone })
  zone: PricingZone;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  delivery_charge: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  weight_step_kg: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  cod_percentage: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discount_percentage: number;

  @Column({ type: 'timestamp', nullable: true })
  start_date: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  end_date: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
