import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../users/entities/user.entity';
import {
  NotificationCategory,
  NotificationEntityType,
} from '../notification.types';

@Entity('notifications')
@Index('IDX_notifications_recipient_created', [
  'recipient_user_id',
  'created_at',
])
@Index('IDX_notifications_recipient_read_created', [
  'recipient_user_id',
  'is_read',
  'created_at',
])
@Index('IDX_notifications_dedupe', ['dedupe_key'], {
  unique: true,
  where: '"dedupe_key" IS NOT NULL',
})
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  recipient_user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_user_id' })
  recipient: User;

  @Column({ type: 'varchar', length: 30 })
  recipient_role: UserRole;

  @Column({ type: 'varchar', length: 80 })
  type: string;

  @Column({ type: 'varchar', length: 30, default: NotificationCategory.SYSTEM })
  category: NotificationCategory;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  entity_type: NotificationEntityType | null;

  @Column({ type: 'uuid', nullable: true })
  entity_id: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  action_url: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  is_read: boolean;

  @Column({ type: 'timestamp', nullable: true })
  read_at: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  dedupe_key: string | null;

  @CreateDateColumn()
  created_at: Date;
}
