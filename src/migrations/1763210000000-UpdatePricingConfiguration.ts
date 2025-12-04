import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdatePricingConfiguration1763210000000
  implements MigrationInterface
{
  name = 'UpdatePricingConfiguration1763210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add discount_percentage column if not exists
    await queryRunner.query(
      `ALTER TABLE "pricing_configurations" ADD COLUMN IF NOT EXISTS "discount_percentage" numeric(5,2)`,
    );

    // Drop free_weight_limit column if exists
    await queryRunner.query(
      `ALTER TABLE "pricing_configurations" DROP COLUMN IF EXISTS "free_weight_limit"`,
    );

    // Drop is_active column if exists
    await queryRunner.query(
      `ALTER TABLE "pricing_configurations" DROP COLUMN IF EXISTS "is_active"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore is_active column
    await queryRunner.query(
      `ALTER TABLE "pricing_configurations" ADD "is_active" boolean NOT NULL DEFAULT true`,
    );

    // Restore free_weight_limit column
    await queryRunner.query(
      `ALTER TABLE "pricing_configurations" ADD "free_weight_limit" numeric(5,2) NOT NULL DEFAULT '1.0'`,
    );

    // Drop discount_percentage column
    await queryRunner.query(
      `ALTER TABLE "pricing_configurations" DROP COLUMN "discount_percentage"`,
    );
  }
}
