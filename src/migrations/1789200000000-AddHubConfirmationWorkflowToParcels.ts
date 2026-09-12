import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHubConfirmationWorkflowToParcels1789200000000
  implements MigrationInterface
{
  name = 'AddHubConfirmationWorkflowToParcels1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE constraint_name text;
      BEGIN
        SELECT con.conname INTO constraint_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute attr
          ON attr.attrelid = rel.oid AND attr.attnum = ANY(con.conkey)
        WHERE rel.relname = 'delivery_verifications'
          AND con.contype = 'u'
          AND attr.attname = 'parcel_id'
        LIMIT 1;

        IF constraint_name IS NOT NULL THEN
          EXECUTE format(
            'ALTER TABLE "delivery_verifications" DROP CONSTRAINT %I',
            constraint_name
          );
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_delivery_verifications_parcel_created"
      ON "delivery_verifications" ("parcel_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      ALTER TABLE "parcels"
      ADD COLUMN IF NOT EXISTS "rider_action_status" character varying(50),
      ADD COLUMN IF NOT EXISTS "rider_action_rider_id" uuid,
      ADD COLUMN IF NOT EXISTS "hub_confirmation_status" character varying(20),
      ADD COLUMN IF NOT EXISTS "rider_action_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "hub_confirmed_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "parcels"
      ADD COLUMN IF NOT EXISTS "cod_status" character varying(20)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_parcels_hub_confirmation"
      ON "parcels" ("current_hub_id", "assigned_rider_id", "hub_confirmation_status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_delivery_verifications_parcel_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_parcels_hub_confirmation"`,
    );
    await queryRunner.query(`
      ALTER TABLE "parcels"
      DROP COLUMN IF EXISTS "cod_status",
      DROP COLUMN IF EXISTS "completed_at",
      DROP COLUMN IF EXISTS "hub_confirmed_at",
      DROP COLUMN IF EXISTS "rider_action_at",
      DROP COLUMN IF EXISTS "hub_confirmation_status",
      DROP COLUMN IF EXISTS "rider_action_rider_id",
      DROP COLUMN IF EXISTS "rider_action_status"
    `);
  }
}
