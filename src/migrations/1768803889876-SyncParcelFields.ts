import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * This migration was auto-generated in production.
 * Made safe with IF NOT EXISTS to prevent failures.
 */
export class SyncParcelFields1768803889876 implements MigrationInterface {
  name = 'SyncParcelFields1768803889876';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Safe version - all CREATE statements use IF NOT EXISTS
    // This prevents "already exists" errors
    
    // Banks table (already exists from 1768300000000-CreateBanksTable)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "banks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "short_name" character varying(100) NOT NULL,
        "logo_url" character varying(500),
        "swift_code" character varying(20),
        "is_active" boolean NOT NULL DEFAULT true,
        "display_order" integer NOT NULL DEFAULT '0',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_3975b5f684ec241e3901db62d77" PRIMARY KEY ("id")
      )
    `);

    // Add unique constraints only if they don't exist
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "banks" ADD CONSTRAINT "UQ_bc680de8ba9d7878fddcecd610c" UNIQUE ("name");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "banks" ADD CONSTRAINT "UQ_fc1e1c17969d128521fcc0424d0" UNIQUE ("short_name");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op - don't drop tables that may have data
  }
}

