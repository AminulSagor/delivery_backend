import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Hub } from '../../hubs/entities/hub.entity';
import { Parcel } from '../../parcels/entities/parcel.entity';
import { PickupRequest } from '../../pickup-requests/entities/pickup-request.entity';

export enum BikeType {
  BICYCLE = 'BICYCLE',
  MOTORCYCLE = 'MOTORCYCLE',
  SCOOTER = 'SCOOTER',
  VAN = 'VAN',
}

@Entity('riders')
export class Rider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  // Personal Information
  @Column({ type: 'varchar', length: 500, nullable: true })
  photo: string;

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

  // Financial
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  fixed_salary: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  commission_percentage: number;

  // Documents
  @Column({ type: 'varchar', length: 500 })
  nid_front_photo: string;

  @Column({ type: 'varchar', length: 500 })
  nid_back_photo: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  license_front_photo: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  license_back_photo: string;

  @Column({ type: 'varchar', length: 500 })
  parent_nid_front_photo: string;

  @Column({ type: 'varchar', length: 500 })
  parent_nid_back_photo: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  // Relations
  @OneToMany(() => Parcel, (parcel) => parcel.assignedRider)
  assignedParcels: Parcel[];

  @OneToMany(() => PickupRequest, (pickup) => pickup.assignedRider)
  assignedPickups: PickupRequest[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
