import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeCoverageAreaIdToUuid1763210100000
  implements MigrationInterface
{
  name = 'ChangeCoverageAreaIdToUuid1763210100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Drop ALL foreign key constraints referencing coverage_areas
    const foreignKeys = await queryRunner.query(
      `SELECT constraint_name FROM information_schema.table_constraints 
       WHERE table_name = 'parcels' AND constraint_type = 'FOREIGN KEY' 
       AND constraint_name LIKE '%coverage%'`,
    );
    
    for (const fk of foreignKeys) {
      await queryRunner.query(
        `ALTER TABLE "parcels" DROP CONSTRAINT "${fk.constraint_name}"`,
      );
    }

    // Step 2: Backup coverage areas data
    await queryRunner.query(
      `CREATE TABLE "coverage_areas_backup" AS SELECT * FROM "coverage_areas"`,
    );

    // Step 3: Drop and recreate coverage_areas table with UUID primary key
    await queryRunner.query(`DROP TABLE "coverage_areas" CASCADE`);
    
    await queryRunner.query(
      `CREATE TABLE "coverage_areas" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "division" character varying(100) NOT NULL,
        "city" character varying(100) NOT NULL,
        "city_id" integer NOT NULL,
        "zone" character varying(100) NOT NULL,
        "zone_id" integer NOT NULL,
        "area" character varying(255) NOT NULL,
        "area_id" integer NOT NULL,
        "inside_dhaka_flag" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coverage_areas" PRIMARY KEY ("id")
      )`,
    );

    // Step 4: Restore data (with new UUID IDs)
    await queryRunner.query(
      `INSERT INTO "coverage_areas" (division, city, city_id, zone, zone_id, area, area_id, inside_dhaka_flag, created_at, updated_at)
       SELECT division, city, city_id, zone, zone_id, area, area_id, inside_dhaka_flag, created_at, updated_at
       FROM "coverage_areas_backup"`,
    );

    // Step 5: Clean up backup table
    await queryRunner.query(`DROP TABLE "coverage_areas_backup"`);

    // Step 6: Update parcels table columns to UUID and set to NULL
    await queryRunner.query(
      `ALTER TABLE "parcels" ALTER COLUMN "pickup_coverage_area_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "parcels" ALTER COLUMN "delivery_coverage_area_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "parcels" ALTER COLUMN "pickup_coverage_area_id" TYPE uuid USING NULL::uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "parcels" ALTER COLUMN "delivery_coverage_area_id" TYPE uuid USING NULL::uuid`,
    );

    // Step 7: Recreate foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "parcels" ADD CONSTRAINT "FK_31ebb1c306a184f45473426bec6" 
       FOREIGN KEY ("pickup_coverage_area_id") REFERENCES "coverage_areas"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "parcels" ADD CONSTRAINT "FK_9c8e7e7e0e7e7e7e7e7e7e7e7e7" 
       FOREIGN KEY ("delivery_coverage_area_id") REFERENCES "coverage_areas"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    throw new Error(
      'This migration cannot be reverted automatically. Manual intervention required.',
    );
  }
}
