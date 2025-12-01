import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Return Parcel Tracking
 * 
 * Adds fields to track return parcels:
 * - original_parcel_id: Links return parcel to original delivery parcel
 * - is_return_parcel: Flag to identify return parcels
 */
export class AddReturnParcelTracking1733050000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add original_parcel_id column
    await queryRunner.query(`
      ALTER TABLE parcels 
      ADD COLUMN IF NOT EXISTS original_parcel_id UUID NULL
    `);

    // Add is_return_parcel column
    await queryRunner.query(`
      ALTER TABLE parcels 
      ADD COLUMN IF NOT EXISTS is_return_parcel BOOLEAN DEFAULT FALSE
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_parcels_original_parcel'
        ) THEN
          ALTER TABLE parcels 
          ADD CONSTRAINT fk_parcels_original_parcel 
          FOREIGN KEY (original_parcel_id) 
          REFERENCES parcels(id) 
          ON DELETE SET NULL;
        END IF;
      END
      $$
    `);

    // Add index for faster lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_parcels_original_parcel_id 
      ON parcels(original_parcel_id) 
      WHERE original_parcel_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_parcels_is_return_parcel 
      ON parcels(is_return_parcel) 
      WHERE is_return_parcel = TRUE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_parcels_is_return_parcel`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_parcels_original_parcel_id`);
    await queryRunner.query(`ALTER TABLE parcels DROP CONSTRAINT IF EXISTS fk_parcels_original_parcel`);
    await queryRunner.query(`ALTER TABLE parcels DROP COLUMN IF EXISTS is_return_parcel`);
    await queryRunner.query(`ALTER TABLE parcels DROP COLUMN IF EXISTS original_parcel_id`);
  }
}
