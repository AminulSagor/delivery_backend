import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * This migration was auto-generated in production but all tables already exist.
 * Made as NO-OP to prevent "already exists" errors.
 */
export class SyncParcelFields1768803889876 implements MigrationInterface {
  name = 'SyncParcelFields1768803889876';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // NO-OP: All tables already exist in production
    // This migration is skipped intentionally
    console.log('[MIGRATION] SyncParcelFields1768803889876: Skipped - tables already exist');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op
  }
}
