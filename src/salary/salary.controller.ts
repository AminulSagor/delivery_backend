import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SalaryService } from './salary.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { GenerateSalaryDto } from './dto/generate-salary.dto';
import { ProcessSalaryPaymentDto } from './dto/process-salary-payment.dto';

@Controller('api/salary')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  @Get('create-list')
  getCreateList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.salaryService.getCreateList(Number(page) || 1, Number(limit) || 10);
  }

  @Get('staff/:id/create-details')
  getCreateDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryService.getCreateDetails(id);
  }

  @Post('generate')
  generateSalarySlip(@Body() dto: GenerateSalaryDto) {
    return this.salaryService.generateSalarySlip(dto);
  }

  @Get('pay-list')
  getPayList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.salaryService.getPayList(Number(page) || 1, Number(limit) || 10);
  }

  @Get('staff/:id/payment-details')
  getPaymentDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryService.getPaymentDetails(id);
  }

  @Post('process-payment')
  processPayment(
    @Body() dto: ProcessSalaryPaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.salaryService.processPayment(dto, user.id);
  }

  @Get('staff/:id/payouts')
  getPayouts(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.salaryService.getPayouts(id, Number(page) || 1, Number(limit) || 20);
  }
}
