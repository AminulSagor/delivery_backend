import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add receivable_amount column to parcels table
 * 
 * receivable_amount = product_price - total_charge
 * This is the amount the merchant receives after all fees are deducted.
 */
export class AddReceivableAmountColumn1768086000000 implements MigrationInterface {
  name = 'AddReceivableAmountColumn1768086000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column already exists
    const hasColumn = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'parcels' AND column_name = 'receivable_amount'
    `);

    if (hasColumn.length === 0) {
      // Add receivable_amount column
      await queryRunner.query(`
        ALTER TABLE "parcels" 
        ADD COLUMN "receivable_amount" decimal(10,2) NOT NULL DEFAULT 0
      `);

      // Calculate and update existing parcels
      await queryRunner.query(`
        UPDATE "parcels" 
        SET "receivable_amount" = GREATEST(0, COALESCE("cod_amount", 0) - COALESCE("total_charge", 0))
      `);

      console.log('✅ Added receivable_amount column to parcels');
      console.log('   Formula: receivable_amount = product_price - total_charge');
    } else {
      console.log('✅ receivable_amount column already exists');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "parcels" 
      DROP COLUMN IF EXISTS "receivable_amount"
    `);

    console.log('⬇️ Dropped receivable_amount column');
  }
}

