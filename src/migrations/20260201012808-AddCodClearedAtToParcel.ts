import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCodClearedAtToParcel20260201012808
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add cod_cleared_at column to parcels table
    await queryRunner.addColumn(
      'parcels',
      new TableColumn({
        name: 'cod_cleared_at',
        type: 'timestamp',
        isNullable: true,
        comment: 'Timestamp when rider cleared COD with hub manager',
      }),
    );

    // Create index for better query performance
    await queryRunner.query(`
      CREATE INDEX "IDX_parcel_cod_cleared_at" ON "parcels" ("cod_cleared_at")
      WHERE "cod_cleared_at" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_parcel_cod_cleared_at";
    `);

    // Drop column
    await queryRunner.dropColumn('parcels', 'cod_cleared_at');
  }
}
