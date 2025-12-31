import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateRiderSettlementsTable1734885000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create rider_settlements table
    await queryRunner.createTable(
      new Table({
        name: 'rider_settlements',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'rider_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'hub_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'hub_manager_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'total_collected_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'cash_received',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'discrepancy_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'previous_due_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'new_due_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'completed_deliveries',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'delivered_count',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'partial_delivery_count',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'exchange_count',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'paid_return_count',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'returned_count',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'settlement_status',
            type: 'enum',
            enum: ['PENDING', 'COMPLETED', 'PARTIAL'],
            default: "'PENDING'",
            isNullable: false,
          },
          {
            name: 'period_start',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'period_end',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'settled_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
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

    // Create indexes
    await queryRunner.createIndex(
      'rider_settlements',
      new TableIndex({
        name: 'IDX_rider_settlement_rider_settled',
        columnNames: ['rider_id', 'settled_at'],
      }),
    );

    await queryRunner.createIndex(
      'rider_settlements',
      new TableIndex({
        name: 'IDX_rider_settlement_hub_settled',
        columnNames: ['hub_id', 'settled_at'],
      }),
    );

    await queryRunner.createIndex(
      'rider_settlements',
      new TableIndex({
        name: 'IDX_rider_settlement_status',
        columnNames: ['settlement_status'],
      }),
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'rider_settlements',
      new TableForeignKey({
        name: 'FK_rider_settlement_rider',
        columnNames: ['rider_id'],
        referencedTableName: 'riders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'rider_settlements',
      new TableForeignKey({
        name: 'FK_rider_settlement_hub',
        columnNames: ['hub_id'],
        referencedTableName: 'hubs',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'rider_settlements',
      new TableForeignKey({
        name: 'FK_rider_settlement_hub_manager',
        columnNames: ['hub_manager_id'],
        referencedTableName: 'hub_managers',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.dropForeignKey(
      'rider_settlements',
      'FK_rider_settlement_hub_manager',
    );
    await queryRunner.dropForeignKey(
      'rider_settlements',
      'FK_rider_settlement_hub',
    );
    await queryRunner.dropForeignKey(
      'rider_settlements',
      'FK_rider_settlement_rider',
    );

    // Drop indexes
    await queryRunner.dropIndex(
      'rider_settlements',
      'IDX_rider_settlement_status',
    );
    await queryRunner.dropIndex(
      'rider_settlements',
      'IDX_rider_settlement_hub_settled',
    );
    await queryRunner.dropIndex(
      'rider_settlements',
      'IDX_rider_settlement_rider_settled',
    );

    // Drop table
    await queryRunner.dropTable('rider_settlements');
  }
}

