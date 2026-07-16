import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SalaryService } from './salary.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PayoutHistoryController {
  constructor(private readonly salaryService: SalaryService) {}

  @Get('payout-history')
  getPayoutHistoryList(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.salaryService.getPayoutHistoryList(
      search,
      Number(page) || 1,
      Number(limit) || 10,
      startDate,
      endDate,
    );
  }

  @Get('payout-history-details/:id')
  getPayoutHistoryDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryService.getPayoutHistoryDetails(id);
  }
}
