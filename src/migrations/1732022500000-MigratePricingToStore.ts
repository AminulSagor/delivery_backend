import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class MigratePricingToStore1732022500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add new store_id column (nullable initially)
    await queryRunner.addColumn(
      'pricing_configurations',
      new TableColumn({
        name: 'store_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Step 2: Migrate existing data
    // For each merchant's pricing, assign it to their default store
    // If no default store exists, assign to first store
    // Note: At this migration point, the column is still named 'exchange_parcel' (not 'is_default')
    // Use exchange_parcel = true as the "default" store indicator
    await queryRunner.query(`
      UPDATE pricing_configurations pc
      SET store_id = (
        SELECT s.id 
        FROM stores s
        WHERE s.merchant_id = pc.merchant_id
        AND s.exchange_parcel = true
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1 FROM stores s 
        WHERE s.merchant_id = pc.merchant_id 
        AND s.exchange_parcel = true
      );
    `);

    // For merchants without a default store, use the first store
    await queryRunner.query(`
      UPDATE pricing_configurations pc
      SET store_id = (
        SELECT s.id 
        FROM stores s
        WHERE s.merchant_id = pc.merchant_id
        ORDER BY s.created_at ASC
        LIMIT 1
      )
      WHERE store_id IS NULL
      AND EXISTS (
        SELECT 1 FROM stores s 
        WHERE s.merchant_id = pc.merchant_id
      );
    `);

    // Step 3: Make store_id NOT NULL
    await queryRunner.changeColumn(
      'pricing_configurations',
      'store_id',
      new TableColumn({
        name: 'store_id',
        type: 'uuid',
        isNullable: false,
      }),
    );

    // Step 4: Drop old merchant_id foreign key
    const table = await queryRunner.getTable('pricing_configurations');
    if (table) {
      const merchantForeignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('merchant_id') !== -1,
      );
      if (merchantForeignKey) {
        await queryRunner.dropForeignKey('pricing_configurations', merchantForeignKey);
      }
    }

    // Step 5: Drop merchant_id column
    await queryRunner.dropColumn('pricing_configurations', 'merchant_id');

    // Step 6: Add foreign key constraint for store_id
    await queryRunner.createForeignKey(
      'pricing_configurations',
      new TableForeignKey({
        columnNames: ['store_id'],
        referencedTableName: 'stores',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        name: 'fk_pricing_store',
      }),
    );

    // Step 7: Create index for better query performance
    await queryRunner.query(`
      CREATE INDEX idx_pricing_store_id ON pricing_configurations(store_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse migration: store_id back to merchant_id
    
    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pricing_store_id;`);

    // Drop foreign key
    const table = await queryRunner.getTable('pricing_configurations');
    if (table) {
      const storeForeignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('store_id') !== -1,
      );
      if (storeForeignKey) {
        await queryRunner.dropForeignKey('pricing_configurations', storeForeignKey);
      }
    }

    // Add merchant_id column back
    await queryRunner.addColumn(
      'pricing_configurations',
      new TableColumn({
        name: 'merchant_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Migrate data back: get merchant_id from store
    await queryRunner.query(`
      UPDATE pricing_configurations pc
      SET merchant_id = (
        SELECT s.merchant_id 
        FROM stores s
        WHERE s.id = pc.store_id
      );
    `);

    // Make merchant_id NOT NULL
    await queryRunner.changeColumn(
      'pricing_configurations',
      'merchant_id',
      new TableColumn({
        name: 'merchant_id',
        type: 'uuid',
        isNullable: false,
      }),
    );

    // Add foreign key for merchant_id
    await queryRunner.createForeignKey(
      'pricing_configurations',
      new TableForeignKey({
        columnNames: ['merchant_id'],
        referencedTableName: 'merchants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        name: 'fk_pricing_merchant',
      }),
    );

    // Drop store_id column
    await queryRunner.dropColumn('pricing_configurations', 'store_id');
  }
}
