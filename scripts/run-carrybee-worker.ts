import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CarrybeeAssignmentWorker } from '../src/workers/carrybee-assignment.worker';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const worker = app.get(CarrybeeAssignmentWorker);

  const shutdown = async () => {
    console.log('Shutting down worker...');
    try {
      worker.stop();
      await app.close();
      process.exit(0);
    } catch (err) {
      console.error('Error shutting down', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await worker.start();
  } catch (err) {
    console.error('Worker error', err);
    await app.close();
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error('Worker bootstrap failed', err);
  process.exit(1);
});
