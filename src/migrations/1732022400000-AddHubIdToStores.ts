import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddHubIdToStores1732022400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add hub_id column to stores table
    await queryRunner.addColumn(
      'stores',
      new TableColumn({
        name: 'hub_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add foreign key constraint
    await queryRunner.createForeignKey(
      'stores',
      new TableForeignKey({
        columnNames: ['hub_id'],
        referencedTableName: 'hubs',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        name: 'fk_stores_hub',
      }),
    );

    // Create index for better query performance
    await queryRunner.query(`
      CREATE INDEX idx_stores_hub_id ON stores(hub_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    const table = await queryRunner.getTable('stores');
    if (table) {
      const foreignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('hub_id') !== -1,
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey('stores', foreignKey);
      }
    }

    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS idx_stores_hub_id;`);

    // Drop column
    await queryRunner.dropColumn('stores', 'hub_id');
  }
}
