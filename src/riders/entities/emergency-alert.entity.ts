import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Rider } from '../../riders/entities/rider.entity';
import { Hub } from '../../hubs/entities/hub.entity';
import { User } from '../../users/entities/user.entity';
import {
  EmergencyType,
  EmergencyStatus,
} from '../../common/enums/emergency-type.enum';

@Entity('emergency_alerts')
@Index(['hub_id', 'status']) // For Hub Manager dashboard
export class EmergencyAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ===== WHO IS IN DANGER? =====
  @Column({ type: 'uuid' })
  rider_id: string;

  @ManyToOne(() => Rider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rider_id' })
  rider: Rider;

  // ===== WHICH HUB IS RESPONSIBLE? =====
  @Column({ type: 'uuid' })
  hub_id: string;

  @ManyToOne(() => Hub, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hub_id' })
  hub: Hub;

  // ===== ALERT DETAILS =====
  @Column({
    type: 'enum',
    enum: EmergencyType,
  })
  type: EmergencyType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // ===== LOCATION (CRITICAL) =====
  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number | null;

  @Column({ type: 'text', nullable: true })
  location_address: string | null;

  // ===== STATUS & RESOLUTION =====
  @Column({
    type: 'enum',
    enum: EmergencyStatus,
    default: EmergencyStatus.PENDING,
  })
  status: EmergencyStatus;

  @Column({ type: 'uuid', nullable: true })
  resolved_by_id: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by_id' })
  resolvedBy: User | null;

  @Column({ type: 'text', nullable: true })
  resolution_notes: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resolved_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
