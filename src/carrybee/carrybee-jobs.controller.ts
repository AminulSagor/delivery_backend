import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CarrybeeJobsService } from './carrybee-jobs.service';

@Controller('admin/carrybee/jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CarrybeeJobsController {
  constructor(private readonly jobsService: CarrybeeJobsService) {}

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page', ParseIntPipe) page = 1,
    @Query('limit', ParseIntPipe) limit = 20,
  ) {
    return await this.jobsService.listJobs({ status, type, page, limit });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return await this.jobsService.getJob(id);
  }

  @Post(':id/requeue')
  async requeue(
    @Param('id') id: string,
    @Body('delayMinutes') delayMinutes = 0,
  ) {
    return await this.jobsService.requeueJob(id, Number(delayMinutes || 0));
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    return await this.jobsService.retryJobNow(id);
  }

  @Post(':id/run')
  async run(@Param('id') id: string) {
    return await this.jobsService.runJobNow(id);
  }
}
