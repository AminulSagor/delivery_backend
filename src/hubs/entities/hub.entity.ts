import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { User } from '../../users/entities/user.entity';
import { HubStatus } from '../../common/enums/hub-status.enum';

@Entity('hubs')
export class Hub {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  hub_code: string;

  @Column({ type: 'varchar', length: 255 })
  branch_name: string;

  @Column({ type: 'varchar', length: 255 })
  area: string;

  @Column({ type: 'text' })
  address: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255 })
  manager_name: string;

  @Exclude()
  @Column({ type: 'varchar', length: 50 })
  manager_phone: string;

  @Column({ type: 'uuid', nullable: true })
  manager_user_id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'manager_user_id' })
  manager_user: User;

  @Column({
    type: 'enum',
    enum: HubStatus,
    default: HubStatus.ACTIVE,
  })
  status: HubStatus;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
