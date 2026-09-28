import { MigrationInterface, QueryRunner } from 'typeorm';

/** Preserves legacy pending transfers while moving new debits to approval. */
export class AddHubTransferFundsReserved1790550000000
  implements MigrationInterface
{
  name = 'AddHubTransferFundsReserved1790550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('hub_transfer_records');
    if (!table || table.findColumnByName('funds_reserved')) return;

    await queryRunner.query(`
      ALTER TABLE "hub_transfer_records"
      ADD COLUMN "funds_reserved" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('hub_transfer_records');
    if (!table?.findColumnByName('funds_reserved')) return;
    await queryRunner.query(`
      ALTER TABLE "hub_transfer_records" DROP COLUMN "funds_reserved"
    `);
  }
}
