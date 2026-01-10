import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Merchant } from '../../merchant/entities/merchant.entity';
import { Hub } from '../../hubs/entities/hub.entity';

@Entity('stores')
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  store_code: string | null; // Auto-generated unique code (e.g., TSH001)

  @Column({ type: 'uuid' })
  merchant_id: string;

  @ManyToOne(() => Merchant)
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @Column({ type: 'varchar', length: 255 })
  business_name: string;

  @Column({ type: 'text' })
  business_address: string;

  @Column({ type: 'varchar', length: 50 })
  phone_number: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  facebook_page: string | null;

  @Column({ type: 'uuid', nullable: true })
  hub_id: string | null;

  @ManyToOne(() => Hub, { nullable: true })
  @JoinColumn({ name: 'hub_id' })
  hub: Hub | null;

  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  // ===== LOCATION FIELDS =====
  @Column({ type: 'varchar', length: 100, nullable: true })
  district: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  thana: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  area: string | null;

  // ===== CARRYBEE INTEGRATION =====
  @Column({ type: 'varchar', length: 100, nullable: true })
  carrybee_store_id: string | null;

  @Column({ type: 'int', nullable: true })
  carrybee_city_id: number | null;

  @Column({ type: 'int', nullable: true })
  carrybee_zone_id: number | null;

  @Column({ type: 'int', nullable: true })
  carrybee_area_id: number | null;

  @Column({ type: 'boolean', default: false })
  is_carrybee_synced: boolean;

  @Column({ type: 'timestamp', nullable: true })
  carrybee_synced_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
