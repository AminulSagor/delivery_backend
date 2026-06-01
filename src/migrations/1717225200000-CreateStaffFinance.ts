import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateStaffFinance1717225200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'staff_finances',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'staff_id',
            type: 'uuid',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'total_paid_amount',
            type: 'numeric',
            precision: 12,
            scale: 2,
            default: 0,
          },
          {
            name: 'remaining_balance',
            type: 'numeric',
            precision: 12,
            scale: 2,
            default: 0,
          },
          {
            name: 'last_payout_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'last_payout_amount',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'NOW()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'NOW()',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['staff_id'],
            referencedTableName: 'staffs',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Create index for staff_id
    await queryRunner.createIndex(
      'staff_finances',
      new TableIndex({
        columnNames: ['staff_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('staff_finances', true);
  }
}
