import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoverageAreaToCustomers1768097000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop old text-based delivery address columns
    await queryRunner.query(`
      ALTER TABLE "customers" 
      DROP COLUMN IF EXISTS "city",
      DROP COLUMN IF EXISTS "zone",
      DROP COLUMN IF EXISTS "area"
    `);

    // 2. Add delivery_coverage_area_id column
    await queryRunner.query(`
      ALTER TABLE "customers" 
      ADD COLUMN "delivery_coverage_area_id" uuid NULL
    `);

    // 3. Add FK constraint to coverage_areas
    await queryRunner.query(`
      ALTER TABLE "customers" 
      ADD CONSTRAINT "FK_customers_delivery_coverage_area" 
      FOREIGN KEY ("delivery_coverage_area_id") 
      REFERENCES "coverage_areas"("id") 
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // 4. Add created_at and updated_at columns if they don't exist
    await queryRunner.query(`
      ALTER TABLE "customers" 
      ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP NOT NULL DEFAULT now()
    `);

    // 5. Create index for faster lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customers_delivery_coverage_area" 
      ON "customers" ("delivery_coverage_area_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_customers_delivery_coverage_area"
    `);

    // 2. Drop FK constraint
    await queryRunner.query(`
      ALTER TABLE "customers" 
      DROP CONSTRAINT IF EXISTS "FK_customers_delivery_coverage_area"
    `);

    // 3. Drop delivery_coverage_area_id column
    await queryRunner.query(`
      ALTER TABLE "customers" 
      DROP COLUMN IF EXISTS "delivery_coverage_area_id"
    `);

    // 4. Re-add old text columns
    await queryRunner.query(`
      ALTER TABLE "customers" 
      ADD COLUMN "city" VARCHAR(100) NULL,
      ADD COLUMN "zone" VARCHAR(100) NULL,
      ADD COLUMN "area" VARCHAR(255) NULL
    `);

    // 5. Drop timestamp columns
    await queryRunner.query(`
      ALTER TABLE "customers" 
      DROP COLUMN IF EXISTS "created_at",
      DROP COLUMN IF EXISTS "updated_at"
    `);
  }
}

