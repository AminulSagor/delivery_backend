import { MigrationInterface, QueryRunner } from "typeorm";

export class SyncSchema1768134360549 implements MigrationInterface {
    name = 'SyncSchema1768134360549'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pricing_configurations" RENAME COLUMN "weight_charge_per_kg" TO "weight_step_kg"`);
        await queryRunner.query(`CREATE TABLE "merchant_finances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" uuid NOT NULL, "current_balance" numeric(12,2) NOT NULL DEFAULT '0', "pending_balance" numeric(12,2) NOT NULL DEFAULT '0', "invoiced_balance" numeric(12,2) NOT NULL DEFAULT '0', "processing_balance" numeric(12,2) NOT NULL DEFAULT '0', "hold_amount" numeric(12,2) NOT NULL DEFAULT '0', "total_earned" numeric(12,2) NOT NULL DEFAULT '0', "total_withdrawn" numeric(12,2) NOT NULL DEFAULT '0', "total_delivery_charges" numeric(12,2) NOT NULL DEFAULT '0', "total_return_charges" numeric(12,2) NOT NULL DEFAULT '0', "total_cod_collected" numeric(12,2) NOT NULL DEFAULT '0', "total_parcels_delivered" integer NOT NULL DEFAULT '0', "total_parcels_returned" integer NOT NULL DEFAULT '0', "credit_limit" numeric(12,2) NOT NULL DEFAULT '0', "credit_used" numeric(12,2) NOT NULL DEFAULT '0', "last_transaction_at" TIMESTAMP, "last_withdrawal_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0fca3f98676d12c46064bf33d8f" UNIQUE ("merchant_id"), CONSTRAINT "REL_0fca3f98676d12c46064bf33d8" UNIQUE ("merchant_id"), CONSTRAINT "PK_4043bf7a98ee2f1df2bfd78ddd1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0fca3f98676d12c46064bf33d8" ON "merchant_finances" ("merchant_id") `);
        await queryRunner.query(`CREATE TYPE "public"."merchant_finance_transactions_transaction_type_enum" AS ENUM('CREDIT', 'DEBIT')`);
        await queryRunner.query(`CREATE TYPE "public"."merchant_finance_transactions_reference_type_enum" AS ENUM('PARCEL_DELIVERED', 'PARCEL_PARTIAL_DELIVERY', 'PARCEL_EXCHANGE', 'PARCEL_PAID_RETURN', 'ADJUSTMENT_CREDIT', 'REFUND', 'DELIVERY_CHARGE', 'RETURN_CHARGE', 'INVOICE_PAID', 'WITHDRAWAL', 'ADJUSTMENT_DEBIT', 'CLEARANCE')`);
        await queryRunner.query(`CREATE TABLE "merchant_finance_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" uuid NOT NULL, "transaction_type" "public"."merchant_finance_transactions_transaction_type_enum" NOT NULL, "amount" numeric(12,2) NOT NULL, "balance_after" numeric(12,2) NOT NULL, "balance_before" numeric(12,2) NOT NULL, "reference_type" "public"."merchant_finance_transactions_reference_type_enum" NOT NULL, "reference_id" uuid, "reference_code" character varying(100), "description" text, "notes" text, "cod_amount" numeric(12,2), "delivery_charge" numeric(12,2), "return_charge" numeric(12,2), "created_by" uuid, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b4c12b9574ce8bfcc10a3bb8379" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e4ca9c22faca33817c9eab3938" ON "merchant_finance_transactions" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_ca6b667247b60ed98d9c309436" ON "merchant_finance_transactions" ("transaction_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_8ff23741a248fd0503d748d1b0" ON "merchant_finance_transactions" ("reference_type", "reference_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_32afd3fb0c4d7d218dbe405927" ON "merchant_finance_transactions" ("merchant_id", "created_at") `);
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "pickup_address"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "delivery_address"`);
        await queryRunner.query(`ALTER TABLE "stores" ADD "store_code" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "stores" ADD CONSTRAINT "UQ_2036aef5ff1670dac3746643f2e" UNIQUE ("store_code")`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD "delivery_area" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD "customer_secondary_phone" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD "customer_address" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD "is_exchange" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD "receivable_amount" numeric(10,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`CREATE TYPE "public"."parcels_issue_type_enum" AS ENUM('INCORRECT_ADDRESS', 'INCORRECT_PHONE', 'COD_AMOUNT_MISMATCH', 'PARCEL_DAMAGED', 'CUSTOMER_REFUSED_TO_PAY', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD "issue_type" "public"."parcels_issue_type_enum"`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD "issue_description" text`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD "issue_reported_by_id" uuid`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD "issue_reported_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD "is_issue_resolved" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "pricing_configurations" ALTER COLUMN "weight_step_kg" TYPE numeric(5,2)`);
        await queryRunner.query(`ALTER TABLE "pricing_configurations" ALTER COLUMN "weight_step_kg" SET DEFAULT '0.5'`);
        await queryRunner.query(`ALTER TABLE "delivery_verifications" ALTER COLUMN "amount_difference" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_coverage_areas_zone_id" ON "coverage_areas" ("zone_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_coverage_areas_city_id" ON "coverage_areas" ("city_id") `);
        await queryRunner.query(`ALTER TABLE "coverage_areas" ADD CONSTRAINT "UQ_coverage_areas_carrybee_ids" UNIQUE ("city_id", "zone_id", "area_id")`);
        await queryRunner.query(`ALTER TABLE "merchant_finances" ADD CONSTRAINT "FK_0fca3f98676d12c46064bf33d8f" FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "merchant_finance_transactions" ADD CONSTRAINT "FK_952594881e8a3e047d1945d1df5" FOREIGN KEY ("merchant_id") REFERENCES "merchant_finances"("merchant_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "merchant_finance_transactions" ADD CONSTRAINT "FK_247481d414be387fed60611c846" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "merchant_finance_transactions" DROP CONSTRAINT "FK_247481d414be387fed60611c846"`);
        await queryRunner.query(`ALTER TABLE "merchant_finance_transactions" DROP CONSTRAINT "FK_952594881e8a3e047d1945d1df5"`);
        await queryRunner.query(`ALTER TABLE "merchant_finances" DROP CONSTRAINT "FK_0fca3f98676d12c46064bf33d8f"`);
        await queryRunner.query(`ALTER TABLE "coverage_areas" DROP CONSTRAINT "UQ_coverage_areas_carrybee_ids"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_coverage_areas_city_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_coverage_areas_zone_id"`);
        await queryRunner.query(`ALTER TABLE "delivery_verifications" ALTER COLUMN "amount_difference" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pricing_configurations" ALTER COLUMN "weight_step_kg" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "pricing_configurations" ALTER COLUMN "weight_step_kg" TYPE numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "is_issue_resolved"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "issue_reported_at"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "issue_reported_by_id"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "issue_description"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "issue_type"`);
        await queryRunner.query(`DROP TYPE "public"."parcels_issue_type_enum"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "receivable_amount"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "is_exchange"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "customer_address"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "customer_secondary_phone"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "delivery_area"`);
        await queryRunner.query(`ALTER TABLE "stores" DROP CONSTRAINT "UQ_2036aef5ff1670dac3746643f2e"`);
        await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN "store_code"`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD "delivery_address" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD "pickup_address" text NOT NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_32afd3fb0c4d7d218dbe405927"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ff23741a248fd0503d748d1b0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ca6b667247b60ed98d9c309436"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e4ca9c22faca33817c9eab3938"`);
        await queryRunner.query(`DROP TABLE "merchant_finance_transactions"`);
        await queryRunner.query(`DROP TYPE "public"."merchant_finance_transactions_reference_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."merchant_finance_transactions_transaction_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0fca3f98676d12c46064bf33d8"`);
        await queryRunner.query(`DROP TABLE "merchant_finances"`);
        await queryRunner.query(`ALTER TABLE "pricing_configurations" RENAME COLUMN "weight_step_kg" TO "weight_charge_per_kg"`);
    }

}
