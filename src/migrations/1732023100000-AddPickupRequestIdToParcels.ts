import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class AddPickupRequestIdToParcels1732023100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add pickup_request_id column to parcels table
    await queryRunner.addColumn(
      'parcels',
      new TableColumn({
        name: 'pickup_request_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add foreign key constraint
    await queryRunner.createForeignKey(
      'parcels',
      new TableForeignKey({
        columnNames: ['pickup_request_id'],
        referencedTableName: 'pickup_requests',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // Add index for better query performance
    await queryRunner.createIndex(
      'parcels',
      new TableIndex({
        name: 'idx_parcels_pickup_request_id',
        columnNames: ['pickup_request_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.dropIndex('parcels', 'idx_parcels_pickup_request_id');

    // Drop foreign key
    const table = await queryRunner.getTable('parcels');
    if (table) {
      const foreignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('pickup_request_id') !== -1,
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey('parcels', foreignKey);
      }
    }

    // Drop column
    await queryRunner.dropColumn('parcels', 'pickup_request_id');
  }
}
