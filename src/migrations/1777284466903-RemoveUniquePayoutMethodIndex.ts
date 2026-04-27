import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveUniquePayoutMethodIndex1777284466903 implements MigrationInterface {
    name = 'RemoveUniquePayoutMethodIndex1777284466903'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_c9a33201674fb2157f09a837ca"`);
        await queryRunner.query(`ALTER TABLE "merchant_payout_methods" ADD "district" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "pricing_configurations" ALTER COLUMN "weight_step_kg" SET DEFAULT '0.5'`);
        await queryRunner.query(`CREATE INDEX "IDX_c9a33201674fb2157f09a837ca" ON "merchant_payout_methods" ("merchant_id", "method_type") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_c9a33201674fb2157f09a837ca"`);
        await queryRunner.query(`ALTER TABLE "pricing_configurations" ALTER COLUMN "weight_step_kg" SET DEFAULT 0.5`);
        await queryRunner.query(`ALTER TABLE "merchant_payout_methods" DROP COLUMN "district"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c9a33201674fb2157f09a837ca" ON "merchant_payout_methods" ("merchant_id", "method_type") `);
    }

}
