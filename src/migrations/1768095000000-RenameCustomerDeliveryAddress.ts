import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameCustomerDeliveryAddress1768095000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename delivery_address to customer_address in customers table
    await queryRunner.query(`
      ALTER TABLE "customers" 
      RENAME COLUMN "delivery_address" TO "customer_address"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: Rename customer_address back to delivery_address
    await queryRunner.query(`
      ALTER TABLE "customers" 
      RENAME COLUMN "customer_address" TO "delivery_address"
    `);
  }
}

