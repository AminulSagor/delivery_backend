import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkParcelToMerchant1769162055991 implements MigrationInterface {
  name = 'LinkParcelToMerchant1769162055991';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the old constraint (that points to users table)
    await queryRunner.query(
      `ALTER TABLE "parcels" DROP CONSTRAINT "FK_84d3757f0e4a20f86842a05a0a2"`,
    );

    // =========================================================
    // ⬇️ ADD THIS BLOCK MANUALLY ⬇️
    // This converts the existing User IDs in 'parcels' to Merchant IDs
    // so they match the new table you are linking to.
    await queryRunner.query(`
        UPDATE "parcels"
        SET "merchant_id" = "merchants"."id"
        FROM "merchants"
        WHERE "parcels"."merchant_id" = "merchants"."user_id"
    `);

    // Optional: Delete "Zombie" parcels (created by users who don't have a merchant profile)
    // If you don't run this, and bad data exists, the next step will still fail.
    await queryRunner.query(`
        DELETE FROM "parcels" 
        WHERE "merchant_id" NOT IN (SELECT "id" FROM "merchants")
    `);
    // =========================================================

    // 2. Now safe to Add the new constraint (points to merchants table)
    await queryRunner.query(
      `ALTER TABLE "parcels" ADD CONSTRAINT "FK_84d3757f0e4a20f86842a05a0a2" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "parcels" DROP CONSTRAINT "FK_84d3757f0e4a20f86842a05a0a2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_configurations" ALTER COLUMN "weight_step_kg" SET DEFAULT 0.5`,
    );
    await queryRunner.query(
      `ALTER TABLE "parcels" ADD CONSTRAINT "FK_84d3757f0e4a20f86842a05a0a2" FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
