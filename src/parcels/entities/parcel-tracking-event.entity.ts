import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Parcel, ParcelStatus } from './parcel.entity';
import {
  ParcelTrackingActorType,
  ParcelTrackingEventType,
} from '../parcel-tracking.types';

@Entity('parcel_tracking_events')
@Index('IDX_parcel_tracking_events_parcel_occurred', [
  'parcel_id',
  'occurred_at',
])
@Index('IDX_parcel_tracking_events_dedupe', ['dedupe_key'], {
  unique: true,
  where: '"dedupe_key" IS NOT NULL',
})
export class ParcelTrackingEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  parcel_id: string;

  @ManyToOne(() => Parcel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parcel_id' })
  parcel: Parcel;

  @Column({ type: 'varchar', length: 80 })
  event_type: ParcelTrackingEventType;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  from_status: ParcelStatus | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  to_status: ParcelStatus | null;

  @Column({
    type: 'varchar',
    length: 40,
    default: ParcelTrackingActorType.SYSTEM,
  })
  actor_type: ParcelTrackingActorType;

  @Column({ type: 'uuid', nullable: true })
  actor_id: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  actor_name: string | null;

  @Column({ type: 'varchar', length: 80, default: 'SYSTEM' })
  source: string;

  @Column({ type: 'uuid', nullable: true })
  hub_id: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  hub_name: string | null;

  @Column({ type: 'uuid', nullable: true })
  from_hub_id: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  from_hub_name: string | null;

  @Column({ type: 'uuid', nullable: true })
  to_hub_id: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  to_hub_name: string | null;

  @Column({ type: 'uuid', nullable: true })
  rider_id: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  rider_name: string | null;

  @Column({ type: 'uuid', nullable: true })
  related_parcel_id: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  related_tracking_number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: true })
  is_public: boolean;

  @Column({ type: 'timestamp' })
  occurred_at: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  dedupe_key: string | null;

  @CreateDateColumn()
  created_at: Date;
}
