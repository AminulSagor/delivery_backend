import { MigrationInterface, QueryRunner } from 'typeorm';

/** Creates persistent in-app notifications when schema sync is disabled. */
export class CreateNotifications1788537600000 implements MigrationInterface {
  name = 'CreateNotifications1788537600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('notifications')) return;

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recipient_user_id" uuid NOT NULL,
        "recipient_role" varchar(30) NOT NULL,
        "type" varchar(80) NOT NULL,
        "category" varchar(30) NOT NULL DEFAULT 'SYSTEM',
        "title" varchar(180) NOT NULL,
        "message" text NOT NULL,
        "entity_type" varchar(40) NULL,
        "entity_id" uuid NULL,
        "action_url" varchar(500) NULL,
        "metadata" jsonb NULL,
        "is_read" boolean NOT NULL DEFAULT false,
        "read_at" timestamp NULL,
        "dedupe_key" varchar(255) NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_recipient"
          FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_recipient_created"
      ON "notifications" ("recipient_user_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_recipient_read_created"
      ON "notifications" ("recipient_user_id", "is_read", "created_at")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_notifications_dedupe"
      ON "notifications" ("dedupe_key")
      WHERE "dedupe_key" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
  }
}
