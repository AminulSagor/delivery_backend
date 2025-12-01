import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreatePickupRequestsTable1732023000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create pickup_requests table
    await queryRunner.createTable(
      new Table({
        name: 'pickup_requests',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'merchant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'store_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'hub_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'estimated_parcels',
            type: 'int',
            default: 0,
          },
          {
            name: 'actual_parcels',
            type: 'int',
            default: 0,
          },
          {
            name: 'comment',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['PENDING', 'CONFIRMED', 'PICKED_UP', 'CANCELLED'],
            default: "'PENDING'",
          },
          {
            name: 'requested_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'confirmed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'picked_up_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'cancelled_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'pickup_requests',
      new TableForeignKey({
        columnNames: ['merchant_id'],
        referencedTableName: 'merchants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'pickup_requests',
      new TableForeignKey({
        columnNames: ['store_id'],
        referencedTableName: 'stores',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'pickup_requests',
      new TableForeignKey({
        columnNames: ['hub_id'],
        referencedTableName: 'hubs',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Add indexes
    await queryRunner.createIndex(
      'pickup_requests',
      new TableIndex({
        name: 'idx_pickup_requests_merchant_id',
        columnNames: ['merchant_id'],
      }),
    );

    await queryRunner.createIndex(
      'pickup_requests',
      new TableIndex({
        name: 'idx_pickup_requests_store_id',
        columnNames: ['store_id'],
      }),
    );

    await queryRunner.createIndex(
      'pickup_requests',
      new TableIndex({
        name: 'idx_pickup_requests_hub_id',
        columnNames: ['hub_id'],
      }),
    );

    await queryRunner.createIndex(
      'pickup_requests',
      new TableIndex({
        name: 'idx_pickup_requests_status',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('pickup_requests', 'idx_pickup_requests_status');
    await queryRunner.dropIndex('pickup_requests', 'idx_pickup_requests_hub_id');
    await queryRunner.dropIndex('pickup_requests', 'idx_pickup_requests_store_id');
    await queryRunner.dropIndex('pickup_requests', 'idx_pickup_requests_merchant_id');

    // Drop foreign keys
    const table = await queryRunner.getTable('pickup_requests');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('pickup_requests', foreignKey);
      }
    }

    // Drop table
    await queryRunner.dropTable('pickup_requests');
  }
}
