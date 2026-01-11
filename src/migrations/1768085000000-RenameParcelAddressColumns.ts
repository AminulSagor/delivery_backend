import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Rename parcel address columns
 * 
 * - delivery_address → customer_address
 * - pickup_address → delivery_area
 */
export class RenameParcelAddressColumns1768085000000 implements MigrationInterface {
  name = 'RenameParcelAddressColumns1768085000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename delivery_address to customer_address
    await queryRunner.query(`
      ALTER TABLE "parcels" 
      RENAME COLUMN "delivery_address" TO "customer_address"
    `);

    // Rename pickup_address to delivery_area
    await queryRunner.query(`
      ALTER TABLE "parcels" 
      RENAME COLUMN "pickup_address" TO "delivery_area"
    `);

    console.log('✅ Renamed parcel address columns:');
    console.log('   - delivery_address → customer_address');
    console.log('   - pickup_address → delivery_area');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: customer_address back to delivery_address
    await queryRunner.query(`
      ALTER TABLE "parcels" 
      RENAME COLUMN "customer_address" TO "delivery_address"
    `);

    // Revert: delivery_area back to pickup_address
    await queryRunner.query(`
      ALTER TABLE "parcels" 
      RENAME COLUMN "delivery_area" TO "pickup_address"
    `);

    console.log('⬇️ Reverted parcel address columns');
  }
}

