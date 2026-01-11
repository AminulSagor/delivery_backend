import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerSecondaryPhone1768090000000
  implements MigrationInterface
{
  name = 'AddCustomerSecondaryPhone1768090000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add customer_secondary_phone column to parcels table
    await queryRunner.query(`
      ALTER TABLE "parcels"
      ADD COLUMN "customer_secondary_phone" VARCHAR(20) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove customer_secondary_phone column from parcels table
    await queryRunner.query(`
      ALTER TABLE "parcels"
      DROP COLUMN "customer_secondary_phone"
    `);
  }
}

