import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to rename commission_percentage to commission_per_delivery
 * 
 * The commission field is NOT a percentage - it's a flat rate per delivered parcel in BDT.
 * e.g., if set to 20, rider gets 20 BDT for each delivered parcel.
 * 
 * "Delivered" includes statuses: DELIVERED, PARTIAL_DELIVERY, EXCHANGE
 */
export class RenameRiderCommissionColumn1768099000000 implements MigrationInterface {
  name = 'RenameRiderCommissionColumn1768099000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename the column from commission_percentage to commission_per_delivery
    await queryRunner.query(`
      ALTER TABLE "riders" 
      RENAME COLUMN "commission_percentage" TO "commission_per_delivery"
    `);

    // Change precision from (5,2) to (10,2) to allow larger amounts
    await queryRunner.query(`
      ALTER TABLE "riders" 
      ALTER COLUMN "commission_per_delivery" TYPE DECIMAL(10,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert precision change
    await queryRunner.query(`
      ALTER TABLE "riders" 
      ALTER COLUMN "commission_per_delivery" TYPE DECIMAL(5,2)
    `);

    // Rename back to original
    await queryRunner.query(`
      ALTER TABLE "riders" 
      RENAME COLUMN "commission_per_delivery" TO "commission_percentage"
    `);
  }
}

