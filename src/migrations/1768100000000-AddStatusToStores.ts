import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add status column to stores table
 * 
 * The stores entity has a status column (PENDING, APPROVED, DECLINED)
 * but it was never added via migration.
 */
export class AddStatusToStores1768100000000 implements MigrationInterface {
  name = 'AddStatusToStores1768100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the enum type already exists
    const enumExists = await queryRunner.query(`
      SELECT 1 FROM pg_type WHERE typname = 'stores_status_enum'
    `);

    if (enumExists.length === 0) {
      // Create the enum type
      await queryRunner.query(`
        CREATE TYPE "stores_status_enum" AS ENUM('PENDING', 'APPROVED', 'DECLINED')
      `);
    }

    // Check if the column already exists
    const columnExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'stores' AND column_name = 'status'
    `);

    if (columnExists.length === 0) {
      // Add the status column
      await queryRunner.query(`
        ALTER TABLE "stores" 
        ADD COLUMN "status" "stores_status_enum" NOT NULL DEFAULT 'PENDING'
      `);
      console.log('✅ Added status column to stores table');
    } else {
      console.log('✅ Status column already exists in stores table');
    }

    // Also ensure other missing columns exist
    const columnsToAdd = [
      { name: 'district', sql: `ADD COLUMN IF NOT EXISTS "district" varchar(100)` },
      { name: 'thana', sql: `ADD COLUMN IF NOT EXISTS "thana" varchar(100)` },
      { name: 'area', sql: `ADD COLUMN IF NOT EXISTS "area" varchar(100)` },
      { name: 'carrybee_store_id', sql: `ADD COLUMN IF NOT EXISTS "carrybee_store_id" varchar(100)` },
      { name: 'carrybee_city_id', sql: `ADD COLUMN IF NOT EXISTS "carrybee_city_id" integer` },
      { name: 'carrybee_zone_id', sql: `ADD COLUMN IF NOT EXISTS "carrybee_zone_id" integer` },
      { name: 'carrybee_area_id', sql: `ADD COLUMN IF NOT EXISTS "carrybee_area_id" integer` },
      { name: 'is_carrybee_synced', sql: `ADD COLUMN IF NOT EXISTS "is_carrybee_synced" boolean DEFAULT false` },
      { name: 'carrybee_synced_at', sql: `ADD COLUMN IF NOT EXISTS "carrybee_synced_at" timestamp` },
    ];

    for (const col of columnsToAdd) {
      try {
        await queryRunner.query(`ALTER TABLE "stores" ${col.sql}`);
      } catch (e) {
        // Column might already exist, ignore error
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if column exists before dropping
    const columnExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'stores' AND column_name = 'status'
    `);

    if (columnExists.length > 0) {
      await queryRunner.query(`
        ALTER TABLE "stores" DROP COLUMN "status"
      `);
    }

    // Drop enum type if no tables are using it
    await queryRunner.query(`
      DROP TYPE IF EXISTS "stores_status_enum"
    `);

    console.log('⬇️ Removed status column from stores table');
  }
}

