import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RiderFinanceService } from '../services/riders-finance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('riders/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RIDER)
export class RiderFinanceController {
  constructor(private readonly riderFinanceService: RiderFinanceService) {}

  @Get('summary')
  @Roles(UserRole.RIDER)
  async getFinanceSummary(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.riderFinanceService.getFinanceSummaryByUserId(
      user.userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    return {
      success: true,
      data,
      message: 'Finance summary retrieved successfully',
    };
  }
}
