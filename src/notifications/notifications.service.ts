import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { Notification } from './entities/notification.entity';
import { NotificationQueryDto } from './dto/notification-query.dto';
import {
  NotificationCategory,
  NotificationEntityType,
  NotificationReadStatus,
} from './notification.types';

export interface CreateNotificationInput {
  recipient_user_id: string;
  recipient_role: UserRole;
  type: string;
  category?: NotificationCategory;
  title: string;
  message: string;
  entity_type?: NotificationEntityType | null;
  entity_id?: string | null;
  action_url?: string | null;
  metadata?: Record<string, unknown> | null;
  dedupe_key?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async findForUser(userId: string, query: NotificationQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const builder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.recipient_user_id = :userId', { userId });

    if (query.status === NotificationReadStatus.READ) {
      builder.andWhere('notification.is_read = true');
    } else if (query.status === NotificationReadStatus.UNREAD) {
      builder.andWhere('notification.is_read = false');
    }
    if (query.category) {
      builder.andWhere('notification.category = :category', {
        category: query.category,
      });
    }
    if (query.type) {
      builder.andWhere('notification.type = :type', { type: query.type });
    }

    builder
      .orderBy('notification.created_at', 'DESC')
      .addOrderBy('notification.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [notifications, total] = await builder.getManyAndCount();
    const unreadCount = await this.countUnread(userId);
    const totalPages = Math.ceil(total / limit);

    return {
      notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      unread_count: unreadCount,
    };
  }

  countUnread(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { recipient_user_id: userId, is_read: false },
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, recipient_user_id: userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (!notification.is_read) {
      notification.is_read = true;
      notification.read_at = new Date();
      await this.notificationRepository.save(notification);
    }
    return notification;
  }

  async markAllAsRead(userId: string) {
    const readAt = new Date();
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ is_read: true, read_at: readAt })
      .where('recipient_user_id = :userId', { userId })
      .andWhere('is_read = false')
      .execute();

    return { updated_count: result.affected || 0, read_at: readAt };
  }

  async create(
    input: CreateNotificationInput,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = manager
      ? manager.getRepository(Notification)
      : this.notificationRepository;
    const notification = repository.create({
      category: NotificationCategory.SYSTEM,
      entity_type: null,
      entity_id: null,
      action_url: null,
      metadata: null,
      dedupe_key: null,
      ...input,
    });
    await repository.save(notification);
  }
}
