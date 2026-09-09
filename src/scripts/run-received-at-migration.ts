import { DataSource } from 'typeorm';
import configuredDataSource from '../data-source';
import { AddReceivedAtToParcels1788912900000 } from '../migrations/1788912900000-AddReceivedAtToParcels';

const migrationTimestamp = 1788912900000;
const migrationName = 'AddReceivedAtToParcels1788912900000';

async function run(): Promise<void> {
  const dataSource = new DataSource({
    ...configuredDataSource.options,
    synchronize: false,
    migrationsRun: false,
  });

  await dataSource.initialize();
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "migrations" (
        "id" SERIAL NOT NULL,
        "timestamp" bigint NOT NULL,
        "name" character varying NOT NULL,
        CONSTRAINT "PK_migrations_id" PRIMARY KEY ("id")
      )
    `);

    const existing = await queryRunner.query(
      `SELECT 1 FROM "migrations" WHERE "timestamp" = $1 AND "name" = $2 LIMIT 1`,
      [migrationTimestamp, migrationName],
    );

    if (existing.length > 0) {
      console.log(`${migrationName} has already been applied.`);
      await queryRunner.rollbackTransaction();
      return;
    }

    await new AddReceivedAtToParcels1788912900000().up(queryRunner);
    await queryRunner.query(
      `INSERT INTO "migrations" ("timestamp", "name") VALUES ($1, $2)`,
      [migrationTimestamp, migrationName],
    );

    await queryRunner.commitTransaction();
    console.log(`${migrationName} applied successfully.`);
  } catch (error) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
    throw error;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

run().catch((error) => {
  console.error(`Failed to apply ${migrationName}:`, error);
  process.exitCode = 1;
});
