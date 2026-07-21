import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the immutable parcel lifecycle ledger for installations that run
 * with schema synchronization disabled. Existing synchronized installations
 * are left untouched.
 */
export class CreateParcelTrackingEvents1784592000000
  implements MigrationInterface
{
  name = 'CreateParcelTrackingEvents1784592000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('parcel_tracking_events')) return;

    await queryRunner.query(`
      CREATE TABLE "parcel_tracking_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "parcel_id" uuid NOT NULL,
        "event_type" varchar(80) NOT NULL,
        "title" varchar(180) NOT NULL,
        "description" text NULL,
        "from_status" varchar(50) NULL,
        "to_status" varchar(50) NULL,
        "actor_type" varchar(40) NOT NULL DEFAULT 'SYSTEM',
        "actor_id" uuid NULL,
        "actor_name" varchar(180) NULL,
        "source" varchar(80) NOT NULL DEFAULT 'SYSTEM',
        "hub_id" uuid NULL,
        "hub_name" varchar(180) NULL,
        "from_hub_id" uuid NULL,
        "from_hub_name" varchar(180) NULL,
        "to_hub_id" uuid NULL,
        "to_hub_name" varchar(180) NULL,
        "rider_id" uuid NULL,
        "rider_name" varchar(180) NULL,
        "related_parcel_id" uuid NULL,
        "related_tracking_number" varchar(80) NULL,
        "location" varchar(255) NULL,
        "metadata" jsonb NULL,
        "is_public" boolean NOT NULL DEFAULT true,
        "occurred_at" timestamp NOT NULL,
        "dedupe_key" varchar(255) NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_parcel_tracking_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_parcel_tracking_events_parcel"
          FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_parcel_tracking_events_parcel_occurred"
      ON "parcel_tracking_events" ("parcel_id", "occurred_at")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_parcel_tracking_events_dedupe"
      ON "parcel_tracking_events" ("dedupe_key")
      WHERE "dedupe_key" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "parcel_tracking_events"`);
  }
}
