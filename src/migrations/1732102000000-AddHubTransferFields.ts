import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHubTransferFields1732102000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add hub transfer tracking fields to parcels table
    await queryRunner.query(`
      ALTER TABLE "parcels" 
      ADD COLUMN "current_hub_id" uuid,
      ADD COLUMN "origin_hub_id" uuid,
      ADD COLUMN "destination_hub_id" uuid,
      ADD COLUMN "is_inter_hub_transfer" boolean DEFAULT false,
      ADD COLUMN "transferred_at" timestamp,
      ADD COLUMN "received_at_destination_hub" timestamp,
      ADD COLUMN "transfer_notes" text
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "parcels"
      ADD CONSTRAINT "FK_parcels_current_hub"
      FOREIGN KEY ("current_hub_id")
      REFERENCES "hubs"("id")
      ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "parcels"
      ADD CONSTRAINT "FK_parcels_origin_hub"
      FOREIGN KEY ("origin_hub_id")
      REFERENCES "hubs"("id")
      ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "parcels"
      ADD CONSTRAINT "FK_parcels_destination_hub"
      FOREIGN KEY ("destination_hub_id")
      REFERENCES "hubs"("id")
      ON DELETE SET NULL
    `);

    // Create indexes for better query performance
    await queryRunner.query(`
      CREATE INDEX "IDX_parcels_current_hub_id" ON "parcels"("current_hub_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_parcels_destination_hub_id" ON "parcels"("destination_hub_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_parcels_is_inter_hub_transfer" ON "parcels"("is_inter_hub_transfer")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_parcels_is_inter_hub_transfer"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_parcels_destination_hub_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_parcels_current_hub_id"`);

    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "parcels" DROP CONSTRAINT IF EXISTS "FK_parcels_destination_hub"`);
    await queryRunner.query(`ALTER TABLE "parcels" DROP CONSTRAINT IF EXISTS "FK_parcels_origin_hub"`);
    await queryRunner.query(`ALTER TABLE "parcels" DROP CONSTRAINT IF EXISTS "FK_parcels_current_hub"`);

    // Drop columns
    await queryRunner.query(`
      ALTER TABLE "parcels"
      DROP COLUMN IF EXISTS "transfer_notes",
      DROP COLUMN IF EXISTS "received_at_destination_hub",
      DROP COLUMN IF EXISTS "transferred_at",
      DROP COLUMN IF EXISTS "is_inter_hub_transfer",
      DROP COLUMN IF EXISTS "destination_hub_id",
      DROP COLUMN IF EXISTS "origin_hub_id",
      DROP COLUMN IF EXISTS "current_hub_id"
    `);
  }
}
