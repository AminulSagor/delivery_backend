import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Merchant } from '../../merchant/entities/merchant.entity';
import { Store } from '../../stores/entities/store.entity';
import { Hub } from '../../hubs/entities/hub.entity';
import { Parcel } from '../../parcels/entities/parcel.entity';
import { Rider } from '../../riders/entities/rider.entity';
import { PickupRequestStatus } from '../../common/enums/pickup-request-status.enum';

@Entity('pickup_requests')
export class PickupRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ===== RELATIONSHIPS =====
  @Column({ type: 'uuid' })
  merchant_id: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @Column({ type: 'uuid' })
  store_id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ type: 'uuid' })
  hub_id: string;

  @ManyToOne(() => Hub, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hub_id' })
  hub: Hub;

  @OneToMany(() => Parcel, (parcel) => parcel.pickupRequest)
  parcels: Parcel[];

  // ===== RIDER ASSIGNMENT =====
  @Column({ type: 'uuid', nullable: true })
  assigned_rider_id: string | null;

  @ManyToOne(() => Rider, (rider) => rider.assignedPickups, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_rider_id' })
  assignedRider: Rider | null;

  @Column({ type: 'timestamp', nullable: true })
  rider_assigned_at: Date | null;

  // ===== REQUEST DETAILS =====
  @Column({ type: 'int', default: 0 })
  estimated_parcels: number;

  @Column({ type: 'int', default: 0 })
  actual_parcels: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  // ===== STATUS =====
  @Column({
    type: 'enum',
    enum: PickupRequestStatus,
    default: PickupRequestStatus.PENDING,
  })
  status: PickupRequestStatus;

  // ===== TIMESTAMPS =====
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  requested_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmed_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  picked_up_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelled_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
