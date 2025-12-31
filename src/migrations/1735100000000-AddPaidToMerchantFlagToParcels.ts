import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaidToMerchantFlagToParcels1735100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add paid_to_merchant flag
    await queryRunner.query(`
      ALTER TABLE parcels 
      ADD COLUMN paid_to_merchant BOOLEAN NOT NULL DEFAULT false
    `);

    // Add paid_to_merchant_at timestamp
    await queryRunner.query(`
      ALTER TABLE parcels 
      ADD COLUMN paid_to_merchant_at TIMESTAMP NULL
    `);

    // Create index for efficient queries
    await queryRunner.query(`
      CREATE INDEX idx_parcels_paid_to_merchant 
      ON parcels(paid_to_merchant)
    `);

    // Create composite index for merchant payment queries
    await queryRunner.query(`
      CREATE INDEX idx_parcels_merchant_payment 
      ON parcels(merchant_id, paid_to_merchant, delivered_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_parcels_merchant_payment
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_parcels_paid_to_merchant
    `);

    // Drop columns
    await queryRunner.query(`
      ALTER TABLE parcels 
      DROP COLUMN IF EXISTS paid_to_merchant_at
    `);

    await queryRunner.query(`
      ALTER TABLE parcels 
      DROP COLUMN IF EXISTS paid_to_merchant
    `);
  }
}

