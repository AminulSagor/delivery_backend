import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParcelTxIdColumn1768800000000 implements MigrationInterface {
  name = 'AddParcelTxIdColumn1768800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add parcel_tx_id column
    await queryRunner.query(`
      ALTER TABLE "parcels" 
      ADD COLUMN IF NOT EXISTS "parcel_tx_id" varchar(20) NULL
    `);

    // Add unique index
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_parcels_parcel_tx_id" 
      ON "parcels" ("parcel_tx_id") 
      WHERE "parcel_tx_id" IS NOT NULL
    `);

    // Generate parcel_tx_id for existing parcels that don't have one
    // Start from 100001 and increment for each existing parcel (ordered by created_at)
    await queryRunner.query(`
      WITH numbered_parcels AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) + 100000 as seq_num
        FROM parcels
        WHERE parcel_tx_id IS NULL
      )
      UPDATE parcels p
      SET parcel_tx_id = '#' || np.seq_num
      FROM numbered_parcels np
      WHERE p.id = np.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index first
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_parcels_parcel_tx_id"
    `);

    // Drop column
    await queryRunner.query(`
      ALTER TABLE "parcels" 
      DROP COLUMN IF EXISTS "parcel_tx_id"
    `);
  }
}
