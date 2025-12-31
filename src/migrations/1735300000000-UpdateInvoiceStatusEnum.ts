import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateInvoiceStatusEnum1735300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update existing GENERATED status to UNPAID
    await queryRunner.query(`
      UPDATE merchant_invoices 
      SET invoice_status = 'UNPAID' 
      WHERE invoice_status = 'GENERATED'
    `);

    // Update existing CANCELLED status to UNPAID (if any)
    await queryRunner.query(`
      UPDATE merchant_invoices 
      SET invoice_status = 'UNPAID' 
      WHERE invoice_status = 'CANCELLED'
    `);

    // Note: PostgreSQL will automatically handle the enum values
    // The application will use: UNPAID, PROCESSING, PAID
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert UNPAID back to GENERATED
    await queryRunner.query(`
      UPDATE merchant_invoices 
      SET invoice_status = 'GENERATED' 
      WHERE invoice_status = 'UNPAID'
    `);

    // Revert PROCESSING to GENERATED
    await queryRunner.query(`
      UPDATE merchant_invoices 
      SET invoice_status = 'GENERATED' 
      WHERE invoice_status = 'PROCESSING'
    `);
  }
}

