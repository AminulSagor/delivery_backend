import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkParcelToMerchant1769162055991 implements MigrationInterface {
  name = 'LinkParcelToMerchant1769162055991';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop old constraint
    await queryRunner.query(
      `ALTER TABLE "parcels" DROP CONSTRAINT "FK_84d3757f0e4a20f86842a05a0a2"`,
    );

    // 2. Map User IDs to Merchant IDs
    await queryRunner.query(`
        UPDATE "parcels"
        SET "merchant_id" = "merchants"."id"
        FROM "merchants"
        WHERE "parcels"."merchant_id" = "merchants"."user_id"
    `);

    // 🔴 REMOVE OR COMMENT OUT THIS DESTRUCTIVE BLOCK 🔴
    /* await queryRunner.query(`
        DELETE FROM "parcels" 
        WHERE "merchant_id" NOT IN (SELECT "id" FROM "merchants")
    `);
    */

    // 3. Add new constraint
    // Note: This might fail if you still have unmapped IDs, but it's better than silent deletion.
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
