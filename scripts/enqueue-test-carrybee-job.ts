import dataSource from '../src/data-source';
import { CarrybeeJob } from '../src/carrybee/entities/carrybee-job.entity';

async function run() {
  await dataSource.initialize();

  const repo = dataSource.getRepository(CarrybeeJob);

  const job = repo.create({
    parcel_id: null,
    type: 'sync_store',
    payload: {},
    status: 'pending',
    attempts: 0,
    last_error: null,
    available_at: null,
  } as any);

  const saved = await repo.save(job as any);
  console.log('Created CarrybeeJob:', saved.id);

  // Poll for status change (up to 60s)
  const start = Date.now();
  while (Date.now() - start < 60000) {
    const current = await repo.findOne({ where: { id: saved.id } as any });
    if (!current) {
      console.error('Job no longer found');
      break;
    }
    console.log('Current status:', current.status, 'attempts:', current.attempts);
    if (current.status !== 'pending' && current.status !== 'in_progress') {
      console.log('Final job state:', current);
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  await dataSource.destroy();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error enqueueing test job', err);
    process.exit(1);
  });
