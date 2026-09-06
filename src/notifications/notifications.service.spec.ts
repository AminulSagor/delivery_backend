import { NotFoundException } from '@nestjs/common';
import { NotificationReadStatus } from './notification.types';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const notification = {
    id: '8d48abe8-823f-4d83-8167-698a492cb47f',
    recipient_user_id: 'user-1',
    is_read: false,
    read_at: null,
  };

  it('returns only the current user notifications with pagination and unread count', async () => {
    const builder: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[notification], 21]),
    };
    const repository: any = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
      count: jest.fn().mockResolvedValue(4),
    };
    const service = new NotificationsService(repository);

    const result = await service.findForUser('user-1', {
      page: 2,
      limit: 10,
      status: NotificationReadStatus.UNREAD,
    });

    expect(builder.where).toHaveBeenCalledWith(
      'notification.recipient_user_id = :userId',
      { userId: 'user-1' },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'notification.is_read = false',
    );
    expect(builder.skip).toHaveBeenCalledWith(10);
    expect(result.pagination).toEqual({
      total: 21,
      page: 2,
      limit: 10,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    });
    expect(result.unread_count).toBe(4);
  });

  it('does not allow a user to mark another user notification as read', async () => {
    const repository: any = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const service = new NotificationsService(repository);

    await expect(
      service.markAsRead('user-2', notification.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: notification.id, recipient_user_id: 'user-2' },
    });
  });

  it('marks all unread notifications for only the current user', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 3 });
    const builder: any = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute,
    };
    const repository: any = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    };
    const service = new NotificationsService(repository);

    const result = await service.markAllAsRead('user-1');

    expect(builder.where).toHaveBeenCalledWith('recipient_user_id = :userId', {
      userId: 'user-1',
    });
    expect(builder.andWhere).toHaveBeenCalledWith('is_read = false');
    expect(result.updated_count).toBe(3);
  });
});
