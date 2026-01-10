import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintToCoverageAreas1736360000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if constraint already exists
    const constraintExists = await queryRunner.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'coverage_areas' 
      AND constraint_name = 'UQ_coverage_areas_carrybee_ids'
    `);

    if (constraintExists.length === 0) {
      // Add unique constraint on city_id, zone_id, area_id
      await queryRunner.query(`
        ALTER TABLE "coverage_areas" 
        ADD CONSTRAINT "UQ_coverage_areas_carrybee_ids" 
        UNIQUE ("city_id", "zone_id", "area_id")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the unique constraint
    await queryRunner.query(`
      ALTER TABLE "coverage_areas" 
      DROP CONSTRAINT IF EXISTS "UQ_coverage_areas_carrybee_ids"
    `);
  }
}

