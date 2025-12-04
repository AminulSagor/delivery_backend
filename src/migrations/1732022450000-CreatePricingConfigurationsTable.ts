import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePricingConfigurationsTable1732022450000 implements MigrationInterface {
  name = 'CreatePricingConfigurationsTable1732022450000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create pricing_zone enum
    await queryRunner.query(`
      CREATE TYPE "pricing_zone_enum" AS ENUM('INSIDE_DHAKA', 'OUTSIDE_DHAKA', 'SUB_DHAKA')
    `);

    // Create pricing_configurations table (with merchant_id - will be migrated to store_id later)
    await queryRunner.query(`
      CREATE TABLE "pricing_configurations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "merchant_id" uuid NOT NULL,
        "zone" "pricing_zone_enum" NOT NULL,
        "delivery_charge" decimal(10,2) NOT NULL,
        "weight_charge_per_kg" decimal(10,2) NOT NULL,
        "cod_percentage" decimal(5,2) NOT NULL,
        "discount_percentage" decimal(5,2),
        "start_date" TIMESTAMP,
        "end_date" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pricing_configurations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pricing_configurations_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    // Create index for better query performance
    await queryRunner.query(`
      CREATE INDEX "IDX_pricing_configurations_merchant_id" ON "pricing_configurations" ("merchant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pricing_configurations_merchant_id"`);
    await queryRunner.query(`DROP TABLE "pricing_configurations"`);
    await queryRunner.query(`DROP TYPE "pricing_zone_enum"`);
  }
}
