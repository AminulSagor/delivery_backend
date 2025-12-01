import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateCoverageAreaWithCarrybeeIds1732600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old columns that are no longer needed (if they exist)
    const table = await queryRunner.getTable('coverage_areas');
    if (table?.findColumnByName('district')) {
      await queryRunner.dropColumn('coverage_areas', 'district');
    }
    if (table?.findColumnByName('coverage')) {
      await queryRunner.dropColumn('coverage_areas', 'coverage');
    }
    if (table?.findColumnByName('delivery_type')) {
      await queryRunner.dropColumn('coverage_areas', 'delivery_type');
    }
    if (table?.findColumnByName('pickup')) {
      await queryRunner.dropColumn('coverage_areas', 'pickup');
    }

    // Rename division column (if needed, or keep as is)
    // Division stays as is

    // Re-fetch table after drops to get current state
    const updatedTable = await queryRunner.getTable('coverage_areas');

    // Add city column (replacing district) if not exists
    if (!updatedTable?.findColumnByName('city')) {
      await queryRunner.addColumn(
        'coverage_areas',
        new TableColumn({
          name: 'city',
          type: 'varchar',
          length: '100',
          isNullable: false,
          default: "''",
        }),
      );
      await queryRunner.query(`ALTER TABLE "coverage_areas" ALTER COLUMN "city" DROP DEFAULT`);
    }

    // Add city_id column if not exists
    if (!updatedTable?.findColumnByName('city_id')) {
      await queryRunner.addColumn(
        'coverage_areas',
        new TableColumn({
          name: 'city_id',
          type: 'int',
          isNullable: false,
          default: 0,
        }),
      );
      await queryRunner.query(`ALTER TABLE "coverage_areas" ALTER COLUMN "city_id" DROP DEFAULT`);
    }

    // Add zone_id column if not exists
    if (!updatedTable?.findColumnByName('zone_id')) {
      await queryRunner.addColumn(
        'coverage_areas',
        new TableColumn({
          name: 'zone_id',
          type: 'int',
          isNullable: false,
          default: 0,
        }),
      );
      await queryRunner.query(`ALTER TABLE "coverage_areas" ALTER COLUMN "zone_id" DROP DEFAULT`);
    }

    // Add area_id column if not exists
    if (!updatedTable?.findColumnByName('area_id')) {
      await queryRunner.addColumn(
        'coverage_areas',
        new TableColumn({
          name: 'area_id',
          type: 'int',
          isNullable: false,
          default: 0,
        }),
      );
      await queryRunner.query(`ALTER TABLE "coverage_areas" ALTER COLUMN "area_id" DROP DEFAULT`);
    }

    // Create indexes for faster lookups (if not exists)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_coverage_areas_city_id" ON "coverage_areas" ("city_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_coverage_areas_zone_id" ON "coverage_areas" ("zone_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_coverage_areas_area_id" ON "coverage_areas" ("area_id")`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_coverage_areas_carrybee_ids" ON "coverage_areas" ("city_id", "zone_id", "area_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_coverage_areas_carrybee_ids"`);
    await queryRunner.query(`DROP INDEX "IDX_coverage_areas_area_id"`);
    await queryRunner.query(`DROP INDEX "IDX_coverage_areas_zone_id"`);
    await queryRunner.query(`DROP INDEX "IDX_coverage_areas_city_id"`);

    // Drop new columns
    await queryRunner.dropColumn('coverage_areas', 'area_id');
    await queryRunner.dropColumn('coverage_areas', 'zone_id');
    await queryRunner.dropColumn('coverage_areas', 'city_id');
    await queryRunner.dropColumn('coverage_areas', 'city');

    // Restore old columns
    await queryRunner.addColumn(
      'coverage_areas',
      new TableColumn({
        name: 'district',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'coverage_areas',
      new TableColumn({
        name: 'coverage',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'coverage_areas',
      new TableColumn({
        name: 'delivery_type',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'coverage_areas',
      new TableColumn({
        name: 'pickup',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    );

    // Revert division and zone to nullable
    await queryRunner.changeColumn(
      'coverage_areas',
      'division',
      new TableColumn({
        name: 'division',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );

    await queryRunner.changeColumn(
      'coverage_areas',
      'zone',
      new TableColumn({
        name: 'zone',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );
  }
}
