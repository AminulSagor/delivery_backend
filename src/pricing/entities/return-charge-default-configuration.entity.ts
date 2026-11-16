import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PricingZone } from '../../common/enums/pricing-zone.enum';
import { ReturnStatus } from './return-charge-configuration.entity';

@Entity('return_charge_default_configurations')
@Unique(['zone', 'return_status'])
export class ReturnChargeDefaultConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: PricingZone })
  zone: PricingZone;

  @Column({ type: 'enum', enum: ReturnStatus })
  return_status: ReturnStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  return_delivery_charge: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  return_weight_charge_per_kg: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  return_cod_percentage: number;

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
