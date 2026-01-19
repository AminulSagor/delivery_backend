import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeliveryAddressToCustomers1768096000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add city, zone, area columns to customers table
    await queryRunner.query(`
      ALTER TABLE "customers" 
      ADD COLUMN "city" VARCHAR(100) NULL,
      ADD COLUMN "zone" VARCHAR(100) NULL,
      ADD COLUMN "area" VARCHAR(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove city, zone, area columns from customers table
    await queryRunner.query(`
      ALTER TABLE "customers" 
      DROP COLUMN "city",
      DROP COLUMN "zone",
      DROP COLUMN "area"
    `);
  }
}

