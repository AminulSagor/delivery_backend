import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to fix financial_status default value
 * Issue: Parcels disappearing from eligible-parcels endpoint after server restart
 * Root Cause: financial_status column default value not set to PENDING in database
 * Solution: Set all parcels with NULL or invalid financial_status to PENDING
 */
export class FixFinancialStatusDefaultValue1737627800000
  implements MigrationInterface
{
  name = 'FixFinancialStatusDefaultValue1737627800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Check current state of financial_status column
    const parcelsWithNullStatus = await queryRunner.query(`
      SELECT COUNT(*) as count 
      FROM parcels 
      WHERE financial_status IS NULL
    `);

    console.log(
      `[MIGRATION] Parcels with NULL financial_status: ${parcelsWithNullStatus[0]?.count || 0}`,
    );

    // Step 2: Set all parcels with NULL financial_status to PENDING
    if (parcelsWithNullStatus[0]?.count > 0) {
      await queryRunner.query(`
        UPDATE parcels 
        SET financial_status = 'PENDING'
        WHERE financial_status IS NULL
      `);

      console.log(
        `[MIGRATION] Updated ${parcelsWithNullStatus[0]?.count} parcels to PENDING financial status`,
      );
    }

    // Step 3: Verify the column default is set properly
    // For PostgreSQL, alter column to add default
    try {
      await queryRunner.query(`
        ALTER TABLE parcels 
        ALTER COLUMN financial_status SET DEFAULT 'PENDING'
      `);

      console.log(
        '[MIGRATION] Set DEFAULT value for financial_status column to PENDING',
      );
    } catch (error) {
      console.log(
        '[MIGRATION] Could not set DEFAULT (might already be set):'
        , error.message
      );
    }

    // Step 4: Log the current distribution of financial_status values
    const statusDistribution = await queryRunner.query(`
      SELECT financial_status, COUNT(*) as count 
      FROM parcels 
      GROUP BY financial_status
      ORDER BY count DESC
    `);

    console.log('[MIGRATION] Financial Status Distribution:');
    statusDistribution.forEach((row) => {
      console.log(
        `  - ${row.financial_status || 'NULL'}: ${row.count} parcels`,
      );
    });

    // Step 5: Verify eligible parcels exist
    const eligibleCount = await queryRunner.query(`
      SELECT COUNT(*) as count
      FROM parcels p
      WHERE p.status IN ('DELIVERED', 'PARTIAL_DELIVERY', 'EXCHANGE', 'PAID_RETURN', 'RETURNED', 'RETURNED_TO_HUB', 'RETURN_TO_MERCHANT')
        AND p.invoice_id IS NULL
        AND p.paid_to_merchant = false
        AND p.financial_status = 'PENDING'
        AND (
          p.cod_collected_amount > 0 
          OR p.delivery_charge_applicable = true 
          OR p.return_charge_applicable = true
        )
    `);

    console.log(
      `[MIGRATION] Eligible parcels after fix: ${eligibleCount[0]?.count || 0}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op: Don't revert this migration as it fixes data integrity
    console.log(
      '[MIGRATION] Down: Skipped - this is a data integrity fix',
    );
  }
}
