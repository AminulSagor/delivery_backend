import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddCarrybeeLocationsTable1732451000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create carrybee_locations table
    await queryRunner.createTable(
      new Table({
        name: 'carrybee_locations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'carrybee_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['CITY', 'ZONE', 'AREA'],
            isNullable: false,
          },
          {
            name: 'parent_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'city_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
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
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'carrybee_locations',
      new TableIndex({
        name: 'IDX_carrybee_locations_type_active',
        columnNames: ['type', 'is_active'],
      }),
    );

    await queryRunner.createIndex(
      'carrybee_locations',
      new TableIndex({
        name: 'IDX_carrybee_locations_parent_id',
        columnNames: ['parent_id'],
      }),
    );

    await queryRunner.createIndex(
      'carrybee_locations',
      new TableIndex({
        name: 'IDX_carrybee_locations_city_id',
        columnNames: ['city_id'],
      }),
    );

    // Create unique constraint on carrybee_id + type
    await queryRunner.createIndex(
      'carrybee_locations',
      new TableIndex({
        name: 'IDX_carrybee_locations_carrybee_id_type',
        columnNames: ['carrybee_id', 'type'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('carrybee_locations');
  }
}
