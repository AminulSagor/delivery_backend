import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRescheduleCountToParcel1737570000000
  implements MigrationInterface
{
  name = 'AddRescheduleCountToParcel1737570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "parcels" 
      ADD COLUMN IF NOT EXISTS "reschedule_count" smallint NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "parcels" 
      DROP COLUMN IF EXISTS "reschedule_count"
    `);
  }
}
