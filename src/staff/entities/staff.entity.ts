import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Hub } from '../../hubs/entities/hub.entity';
import { StaffPosition } from '../../common/enums/staff-position.enum';

export enum BikeType {
  BICYCLE = 'BICYCLE',
  MOTORCYCLE = 'MOTORCYCLE',
  SCOOTER = 'SCOOTER',
  VAN = 'VAN',
}

@Entity('staff')
export class Staff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  staff_code: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  hub_id: string;

  @ManyToOne(() => Hub)
  @JoinColumn({ name: 'hub_id' })
  hub: Hub;

  // Position/Role
  @Column({
    type: 'enum',
    enum: StaffPosition,
    default: StaffPosition.OTHER,
  })
  position: StaffPosition;

  // Personal Information
  @Column({ type: 'varchar', length: 500, nullable: true })
  photo: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  secondary_phone: string;

  @Column({ type: 'varchar', length: 20 })
  guardian_mobile_no: string;

  @Column({
    type: 'enum',
    enum: BikeType,
    default: BikeType.MOTORCYCLE,
  })
  bike_type: BikeType;

  @Column({ type: 'varchar', length: 50, unique: true })
  nid_number: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  license_no: string;

  @Column({ type: 'text' })
  present_address: string;

  @Column({ type: 'text' })
  permanent_address: string;

  // Financial - Only fixed salary, no commission
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  fixed_salary: number;

  // Bank Information
  @Column({ type: 'varchar', length: 255, nullable: true })
  bank_name: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bank_account_number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bank_branch: string | null;

  // Documents
  @Column({ type: 'varchar', length: 500, nullable: true })
  nid_front_photo: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  nid_back_photo: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  license_front_photo: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  license_back_photo: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  parent_nid_front_photo: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  parent_nid_back_photo: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
