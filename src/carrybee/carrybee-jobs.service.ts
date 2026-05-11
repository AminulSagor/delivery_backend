import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarrybeeJob } from './entities/carrybee-job.entity';
import { CarrybeeService } from './carrybee.service';

@Injectable()
export class CarrybeeJobsService {
  private readonly logger = new Logger(CarrybeeJobsService.name);
  private readonly maxAttempts = 5;

  constructor(
    @InjectRepository(CarrybeeJob)
    private readonly jobRepo: Repository<CarrybeeJob>,
    private readonly carrybeeService: CarrybeeService,
  ) {}

  async listJobs(opts: {
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, type, page = 1, limit = 20 } = opts || {};
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [items, total] = await this.jobRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items,
      pagination: {
        total,
        page,
        limit,
      },
    };
  }

  async getJob(id: string) {
    const job = await this.jobRepo.findOne({ where: { id } as any });
    if (!job) throw new NotFoundException('Carrybee job not found');
    return job;
  }

  async requeueJob(id: string, delayMinutes = 0) {
    const job = await this.getJob(id);
    const nextAt =
      delayMinutes > 0
        ? new Date(Date.now() + delayMinutes * 60 * 1000)
        : new Date();
    job.status = 'pending';
    job.attempts = 0;
    job.last_error = null;
    job.available_at = nextAt;
    return await this.jobRepo.save(job);
  }

  async retryJobNow(id: string) {
    const job = await this.getJob(id);
    job.status = 'pending';
    job.available_at = new Date();
    return await this.jobRepo.save(job);
  }

  /**
   * Run a job synchronously (admin action). Currently supports only `assign_parcel` jobs.
   */
  async runJobNow(id: string) {
    const job = await this.getJob(id);

    if (job.status === 'in_progress') {
      throw new BadRequestException('Job is already in progress');
    }

    // Mark in progress and increment attempts
    await this.jobRepo.update(id, {
      status: 'in_progress',
      attempts: (job.attempts || 0) + 1,
    } as any);

    try {
      if (job.type === 'assign_parcel') {
        if (!job.parcel_id)
          throw new BadRequestException('assign_parcel job missing parcel_id');
        const hubId = job.payload?.hubId || job.payload?.hub_id;
        const result = await this.carrybeeService.assignParcelToCarrybee(
          job.parcel_id,
          job.payload || ({} as any),
          hubId as string,
        );

        await this.jobRepo.update(id, {
          status: 'succeeded',
          last_error: null,
          available_at: null,
        } as any);
        return result;
      }

      if (job.type === 'sync_store') {
        const storeId = job.payload?.storeId || job.payload?.store_id;
        if (!storeId)
          throw new BadRequestException('sync_store job missing storeId');
        const result = await this.carrybeeService.syncStoreById(storeId);
        await this.jobRepo.update(id, {
          status: 'succeeded',
          last_error: null,
          available_at: null,
        } as any);
        return result;
      }

      // For other job types, return an explanatory error for now
      throw new BadRequestException(
        `Running job type '${job.type}' synchronously is not supported`,
      );
    } catch (err: any) {
      const attempts = (job.attempts || 0) + 1;
      if (attempts < this.maxAttempts) {
        const backoffMs = Math.pow(2, attempts) * 60 * 1000;
        const nextAt = new Date(Date.now() + backoffMs);
        await this.jobRepo.update(id, {
          status: 'pending',
          attempts,
          last_error: String(err?.message || err),
          available_at: nextAt,
        } as any);
        this.logger.warn(
          `Job ${id} failed, scheduled retry at ${nextAt.toISOString()}: ${err?.message || err}`,
        );
      } else {
        await this.jobRepo.update(id, {
          status: 'failed',
          attempts,
          last_error: String(err?.message || err),
        } as any);
        this.logger.error(
          `Job ${id} failed permanently: ${err?.message || err}`,
        );
      }

      throw err;
    }
  }
}
