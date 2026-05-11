import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CarrybeeService } from '../carrybee/carrybee.service';
import { CarrybeeJob } from '../carrybee/entities/carrybee-job.entity';

@Injectable()
export class CarrybeeAssignmentWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CarrybeeAssignmentWorker.name);
  private running = false;
  private pollInterval = 500; // ms
  private maxAttempts = 5;

  constructor(
    private dataSource: DataSource,
    private carrybeeService: CarrybeeService,
  ) {}

  onModuleInit() {
    // Auto-start worker only when explicitly requested to avoid interfering with single-process deployments
    if (process.env.START_CARRYBEE_WORKER === 'true') {
      this.start().catch((err) =>
        this.logger.error('Failed to auto-start worker', err),
      );
    }
  }

  onModuleDestroy() {
    this.stop();
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.logger.log('CarrybeeAssignmentWorker started');

    while (this.running) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      try {
        await queryRunner.startTransaction();

        const rows: any[] = await queryRunner.query(
          `SELECT * FROM carrybee_job WHERE status = 'pending' AND (available_at IS NULL OR available_at <= now()) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`,
        );

        if (!rows.length) {
          await queryRunner.rollbackTransaction();
          await queryRunner.release();
          await this.sleep(this.pollInterval);
          continue;
        }

        const job = rows[0];

        await queryRunner.query(
          `UPDATE carrybee_job SET status = 'in_progress', attempts = attempts + 1 WHERE id = $1`,
          [job.id],
        );

        await queryRunner.commitTransaction();
        await queryRunner.release();

        // process job outside transaction
        try {
          this.logger.log(`Processing job ${job.id} (type=${job.type})`);
          if (job.type === 'assign_parcel') {
            await this.carrybeeService.assignParcelToCarrybee(
              job.parcel_id,
              job.payload || {},
              job.payload?.hubId || job.payload?.hub_id,
            );
          } else if (job.type === 'sync_store') {
            const storeId = job.payload?.storeId || job.payload?.store_id;
            if (!storeId)
              throw new Error('sync_store job missing storeId in payload');
            await this.carrybeeService.syncStoreById(storeId);
          } else {
            this.logger.warn(
              `Unknown job type '${job.type}' for job ${job.id}`,
            );
          }

          await this.dataSource.getRepository(CarrybeeJob).update(job.id, {
            status: 'succeeded',
            last_error: null,
            available_at: null,
          } as any);
          this.logger.log(`Job ${job.id} succeeded`);
        } catch (err: any) {
          const attempts = job.attempts + 1;
          const transient = true;
          if (transient && attempts < this.maxAttempts) {
            const backoffMs = Math.pow(2, attempts) * 60 * 1000; // exponential minutes
            const nextAt = new Date(Date.now() + backoffMs);
            await this.dataSource.getRepository(CarrybeeJob).update(job.id, {
              status: 'pending',
              attempts,
              last_error: String(err?.message || err),
              available_at: nextAt,
            });
            this.logger.warn(
              `Job ${job.id} failed, will retry at ${nextAt.toISOString()}: ${err?.message || err}`,
            );
          } else {
            await this.dataSource.getRepository(CarrybeeJob).update(job.id, {
              status: 'failed',
              last_error: String(err?.message || err),
            });
            this.logger.error(
              `Job ${job.id} failed permanently: ${err?.message || err}`,
            );
          }
        }
      } catch (outerErr) {
        try {
          await queryRunner.rollbackTransaction();
        } catch {}
        try {
          await queryRunner.release();
        } catch {}
        this.logger.error('Worker outer loop error', outerErr);
        await this.sleep(1000);
      }
    }
  }

  stop() {
    this.running = false;
    this.logger.log('CarrybeeAssignmentWorker stopping');
  }

  private sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }
}
