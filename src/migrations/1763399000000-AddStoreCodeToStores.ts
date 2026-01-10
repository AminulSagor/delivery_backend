import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddStoreCodeToStores1763399000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column already exists
    const table = await queryRunner.getTable('stores');
    const hasColumn = table?.findColumnByName('store_code');

    if (!hasColumn) {
      // Add store_code column
      await queryRunner.addColumn(
        'stores',
        new TableColumn({
          name: 'store_code',
          type: 'varchar',
          length: '20',
          isNullable: true,
          isUnique: true,
          comment: 'Auto-generated unique store code (e.g., TSH001)',
        }),
      );

      // Create unique index on store_code
      await queryRunner.createIndex(
        'stores',
        new TableIndex({
          name: 'IDX_stores_store_code',
          columnNames: ['store_code'],
          isUnique: true,
        }),
      );

      console.log('✅ Added store_code column to stores table');
    } else {
      console.log('ℹ️  store_code column already exists, skipping');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index if exists
    const table = await queryRunner.getTable('stores');
    const hasIndex = table?.indices.find((idx) => idx.name === 'IDX_stores_store_code');
    
    if (hasIndex) {
      await queryRunner.dropIndex('stores', 'IDX_stores_store_code');
    }

    // Drop column if exists
    const hasColumn = table?.findColumnByName('store_code');
    if (hasColumn) {
      await queryRunner.dropColumn('stores', 'store_code');
      console.log('✅ Removed store_code column from stores table');
    }
  }
}

