import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Merchant } from './merchant.entity'; // Adjust path as needed

@Entity('merchant_profiles')
export class MerchantProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  merchant_id: string;

  // 1:1 Relationship with Merchant
  @OneToOne(() => Merchant, (merchant) => merchant.merchant_profile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  // --- General Profile ---
  @Column({ type: 'text', nullable: true })
  profile_img_url: string;

  // --- NID Section ---
  @Column({ type: 'varchar', length: 50, nullable: true })
  nid_number: string;

  @Column({ type: 'text', nullable: true })
  nid_front_url: string;

  @Column({ type: 'text', nullable: true })
  nid_back_url: string;

  // --- Trade License Section ---
  @Column({ type: 'varchar', length: 50, nullable: true })
  trade_license_number: string;

  @Column({ type: 'text', nullable: true })
  trade_license_url: string;

  // --- TIN Section ---
  @Column({ type: 'varchar', length: 50, nullable: true })
  tin_number: string;

  @Column({ type: 'text', nullable: true })
  tin_certificate_url: string;

  // --- BIN Section ---
  @Column({ type: 'varchar', length: 50, nullable: true })
  bin_number: string;

  @Column({ type: 'text', nullable: true })
  bin_certificate_url: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
