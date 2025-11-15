import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateCoverageAreasTable1763193000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'coverage_areas',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'division',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'district',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'zone',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'area',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'coverage',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'delivery_type',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'pickup',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'inside_dhaka_flag',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('coverage_areas');
  }
}
