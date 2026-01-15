import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateBanksTable1768300000000 implements MigrationInterface {
  name = 'CreateBanksTable1768300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if table already exists
    const tableExists = await queryRunner.hasTable('banks');
    
    if (!tableExists) {
      await queryRunner.createTable(
        new Table({
          name: 'banks',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'name',
              type: 'varchar',
              length: '255',
              isUnique: true,
            },
            {
              name: 'short_name',
              type: 'varchar',
              length: '100',
              isUnique: true,
            },
            {
              name: 'logo_url',
              type: 'varchar',
              length: '500',
              isNullable: true,
            },
            {
              name: 'swift_code',
              type: 'varchar',
              length: '20',
              isNullable: true,
            },
            {
              name: 'is_active',
              type: 'boolean',
              default: true,
            },
            {
              name: 'display_order',
              type: 'int',
              default: 0,
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

      // Create index on is_active
      await queryRunner.createIndex(
        'banks',
        new TableIndex({
          name: 'IDX_banks_is_active',
          columnNames: ['is_active'],
        }),
      );

      console.log('✅ Created banks table');
    } else {
      console.log('✅ Banks table already exists');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('banks');
    
    if (tableExists) {
      await queryRunner.dropTable('banks');
      console.log('✅ Dropped banks table');
    }
  }
}

