import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncParcelFields1768803889876 implements MigrationInterface {
  name = 'SyncParcelFields1768803889876';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "banks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "short_name" character varying(100) NOT NULL, "logo_url" character varying(500), "swift_code" character varying(20), "is_active" boolean NOT NULL DEFAULT true, "display_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_bc680de8ba9d7878fddcecd610c" UNIQUE ("name"), CONSTRAINT "UQ_fc1e1c17969d128521fcc0424d0" UNIQUE ("short_name"), CONSTRAINT "PK_3975b5f684ec241e3901db62d77" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9bfde1e81bc86fb447eb732edc" ON "banks" ("is_active") `,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" RENAME COLUMN "delivery_address" TO "customer_address"`,
    );
    await queryRunner.query(
      `ALTER TABLE "riders" DROP COLUMN "commission_percentage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "delivery_coverage_area_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "riders" ADD "commission_per_delivery" numeric(10,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "riders" ADD "bank_name" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "riders" ADD "bank_account_number" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "riders" ADD "bank_branch" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT "UQ_6bc09826e09c8a26cdeb323697b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_configurations" ALTER COLUMN "weight_step_kg" SET DEFAULT '0.5'`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "FK_b3afd06fce5057c271d79f13527" FOREIGN KEY ("delivery_coverage_area_id") REFERENCES "coverage_areas"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT "FK_b3afd06fce5057c271d79f13527"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_configurations" ALTER COLUMN "weight_step_kg" SET DEFAULT 0.5`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "UQ_6bc09826e09c8a26cdeb323697b" UNIQUE ("secondary_number")`,
    );
    await queryRunner.query(`ALTER TABLE "riders" DROP COLUMN "bank_branch"`);
    await queryRunner.query(
      `ALTER TABLE "riders" DROP COLUMN "bank_account_number"`,
    );
    await queryRunner.query(`ALTER TABLE "riders" DROP COLUMN "bank_name"`);
    await queryRunner.query(
      `ALTER TABLE "riders" DROP COLUMN "commission_per_delivery"`,
    );
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "updated_at"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "created_at"`);
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN "delivery_coverage_area_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN "customer_address"`,
    );
    await queryRunner.query(
      `ALTER TABLE "riders" ADD "commission_percentage" numeric(5,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "delivery_address" text NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9bfde1e81bc86fb447eb732edc"`,
    );
    await queryRunner.query(`DROP TABLE "banks"`);
  }
}
