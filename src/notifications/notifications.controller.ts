import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.HUB_MANAGER, UserRole.RIDER)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: NotificationQueryDto,
  ) {
    const data = await this.notificationsService.findForUser(userId, query);
    return { success: true, data, message: 'Notifications retrieved' };
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser('userId') userId: string) {
    const unreadCount = await this.notificationsService.countUnread(userId);
    return {
      success: true,
      data: { unread_count: unreadCount },
      message: 'Unread notification count retrieved',
    };
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@CurrentUser('userId') userId: string) {
    const data = await this.notificationsService.markAllAsRead(userId);
    return { success: true, data, message: 'All notifications marked as read' };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const notification = await this.notificationsService.markAsRead(userId, id);
    return {
      success: true,
      data: { notification },
      message: 'Notification marked as read',
    };
  }
}
