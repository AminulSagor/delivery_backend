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
import { User } from '../../users/entities/user.entity';
import { Hub } from './hub.entity';

import { Exclude } from 'class-transformer';

@Entity('hub_managers')
export class HubManager {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index({ unique: true })
  @Column({ type: 'uuid', unique: true })
  hub_id: string;

  @ManyToOne(() => Hub)
  @JoinColumn({ name: 'hub_id' })
  hub: Hub;

  // Financial
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  fixed_salary: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bank_name: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bank_account_number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bank_branch: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
