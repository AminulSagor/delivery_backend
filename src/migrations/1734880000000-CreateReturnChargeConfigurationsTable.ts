import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateReturnChargeConfigurationsTable1734880000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create return_charge_configurations table
    await queryRunner.createTable(
      new Table({
        name: 'return_charge_configurations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'store_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'return_status',
            type: 'enum',
            enum: ['PARTIAL_DELIVERY', 'EXCHANGE', 'RETURNED', 'PAID_RETURN'],
            isNullable: false,
          },
          {
            name: 'zone',
            type: 'enum',
            enum: ['INSIDE_DHAKA', 'SUB_DHAKA', 'OUTSIDE_DHAKA'],
            isNullable: false,
          },
          {
            name: 'return_delivery_charge',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'return_weight_charge_per_kg',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'return_cod_percentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'discount_percentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'start_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'end_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create unique constraint on store_id + return_status + zone
    await queryRunner.createIndex(
      'return_charge_configurations',
      new TableIndex({
        name: 'UQ_store_status_zone',
        columnNames: ['store_id', 'return_status', 'zone'],
        isUnique: true,
      }),
    );

    // Create index on store_id
    await queryRunner.createIndex(
      'return_charge_configurations',
      new TableIndex({
        name: 'IDX_return_charge_store',
        columnNames: ['store_id'],
      }),
    );

    // Create index on return_status
    await queryRunner.createIndex(
      'return_charge_configurations',
      new TableIndex({
        name: 'IDX_return_charge_status',
        columnNames: ['return_status'],
      }),
    );

    // Create foreign key to stores table
    await queryRunner.createForeignKey(
      'return_charge_configurations',
      new TableForeignKey({
        name: 'FK_return_charge_store',
        columnNames: ['store_id'],
        referencedTableName: 'stores',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.dropForeignKey('return_charge_configurations', 'FK_return_charge_store');

    // Drop indexes
    await queryRunner.dropIndex('return_charge_configurations', 'IDX_return_charge_status');
    await queryRunner.dropIndex('return_charge_configurations', 'IDX_return_charge_store');
    await queryRunner.dropIndex('return_charge_configurations', 'UQ_store_status_zone');

    // Drop table
    await queryRunner.dropTable('return_charge_configurations');
  }
}

