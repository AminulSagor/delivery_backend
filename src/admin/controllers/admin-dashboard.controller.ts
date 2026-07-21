import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AdminDashboardEarningTrendsQueryDto,
  AdminDashboardFlowQueryDto,
  AdminDashboardLifetimeQueryDto,
  AdminDashboardOverviewQueryDto,
} from '../dto/admin-dashboard-query.dto';
import { AdminDashboardService } from '../services/admin-dashboard.service';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  async getOverview(@Query() query: AdminDashboardOverviewQueryDto) {
    return {
      success: true,
      data: await this.dashboardService.getOverview(query),
      message: 'Admin dashboard overview retrieved successfully',
    };
  }

  @Get('parcel-flow')
  @HttpCode(HttpStatus.OK)
  async getParcelFlow(@Query() query: AdminDashboardFlowQueryDto) {
    return {
      success: true,
      data: await this.dashboardService.getParcelFlow(query),
      message: 'Admin dashboard parcel flow retrieved successfully',
    };
  }

  @Get('pending-actions')
  @HttpCode(HttpStatus.OK)
  async getPendingActions() {
    return {
      success: true,
      data: await this.dashboardService.getPendingActions(),
      message: 'Admin dashboard pending actions retrieved successfully',
    };
  }

  @Get('earning-trends')
  @HttpCode(HttpStatus.OK)
  async getEarningTrends(@Query() query: AdminDashboardEarningTrendsQueryDto) {
    return {
      success: true,
      data: await this.dashboardService.getEarningTrends(query),
      message: 'Admin dashboard earning trends retrieved successfully',
    };
  }

  @Get('lifetime-summary')
  @HttpCode(HttpStatus.OK)
  async getLifetimeSummary(@Query() query: AdminDashboardLifetimeQueryDto) {
    return {
      success: true,
      data: await this.dashboardService.getLifetimeSummary(query),
      message: 'Admin dashboard lifetime summary retrieved successfully',
    };
  }
}
