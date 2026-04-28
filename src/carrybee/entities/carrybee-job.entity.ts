import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('carrybee_job')
@Index(['status', 'available_at'])
export class CarrybeeJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  parcel_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  type: string; // 'assign_parcel' | 'sync_store'

  @Column({ type: 'jsonb', nullable: true })
  payload: any | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'in_progress' | 'succeeded' | 'failed';

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  last_error: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  available_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
