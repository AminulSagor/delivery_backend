import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add issue reporting columns to parcels table
 */
export class AddIssueReportingColumns1737580000000 implements MigrationInterface {
  name = 'AddIssueReportingColumns1737580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type if not exists
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE parcel_issue_type_enum AS ENUM (
          'INCORRECT_ADDRESS',
          'INCORRECT_PHONE',
          'COD_AMOUNT_MISMATCH',
          'PARCEL_DAMAGED',
          'CUSTOMER_REFUSED_TO_PAY',
          'OTHER'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // Add issue reporting columns
    await queryRunner.query(`
      ALTER TABLE "parcels" 
      ADD COLUMN IF NOT EXISTS "issue_type" parcel_issue_type_enum NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "parcels" 
      ADD COLUMN IF NOT EXISTS "issue_description" text NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "parcels" 
      ADD COLUMN IF NOT EXISTS "issue_reported_by_id" uuid NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "parcels" 
      ADD COLUMN IF NOT EXISTS "issue_reported_at" timestamp NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "parcels" 
      ADD COLUMN IF NOT EXISTS "is_issue_resolved" boolean DEFAULT false
    `);

    // Also add reschedule_count if not exists
    await queryRunner.query(`
      ALTER TABLE "parcels" 
      ADD COLUMN IF NOT EXISTS "reschedule_count" smallint NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN IF EXISTS "issue_type"`);
    await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN IF EXISTS "issue_description"`);
    await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN IF EXISTS "issue_reported_by_id"`);
    await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN IF EXISTS "issue_reported_at"`);
    await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN IF EXISTS "is_issue_resolved"`);
    await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN IF EXISTS "reschedule_count"`);
    await queryRunner.query(`DROP TYPE IF EXISTS parcel_issue_type_enum`);
  }
}

