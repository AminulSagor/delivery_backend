import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateParcelsTable1732023060000 implements MigrationInterface {
    name = 'CreateParcelsTable1732023060000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."parcels_status_enum" AS ENUM('PENDING', 'PICKED_UP', 'IN_HUB', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'RETURNED')`);
        await queryRunner.query(`CREATE TYPE "public"."parcels_payment_status_enum" AS ENUM('UNPAID', 'PAID', 'COD_COLLECTED')`);
        await queryRunner.query(`CREATE TABLE "parcels" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" uuid NOT NULL, "store_id" uuid, "tracking_number" character varying(50) NOT NULL, "merchant_order_id" character varying(100), "pickup_coverage_area_id" integer, "pickup_store_name" character varying(100) NOT NULL, "pickup_phone" character varying(20) NOT NULL, "pickup_address" text NOT NULL, "delivery_coverage_area_id" integer, "customer_name" character varying(255) NOT NULL, "customer_phone" character varying(20) NOT NULL, "delivery_address" text NOT NULL, "product_description" character varying(255), "product_price" numeric(10,2) NOT NULL DEFAULT '0', "product_weight" numeric(5,2) NOT NULL DEFAULT '0', "parcel_type" character varying(50), "delivery_charge" numeric(10,2) NOT NULL DEFAULT '0', "cod_charge" numeric(10,2) NOT NULL DEFAULT '0', "total_charge" numeric(10,2) NOT NULL DEFAULT '0', "is_cod" boolean NOT NULL DEFAULT false, "cod_amount" numeric(10,2) NOT NULL DEFAULT '0', "status" "public"."parcels_status_enum" NOT NULL DEFAULT 'PENDING', "payment_status" "public"."parcels_payment_status_enum" NOT NULL DEFAULT 'UNPAID', "special_instructions" text, "admin_notes" text, "picked_up_at" TIMESTAMP, "delivered_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0c973dddb14e093406bd405f733" UNIQUE ("tracking_number"), CONSTRAINT "PK_47847f79fee8a3926f2b3022a96" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD CONSTRAINT "FK_84d3757f0e4a20f86842a05a0a2" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD CONSTRAINT "FK_2ad5279e5e33e3c1eb58db96363" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD CONSTRAINT "FK_31ebb1c306a184f45473426bec6" FOREIGN KEY ("pickup_coverage_area_id") REFERENCES "coverage_areas"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD CONSTRAINT "FK_06d4bf6351355857f0de10f8000" FOREIGN KEY ("delivery_coverage_area_id") REFERENCES "coverage_areas"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "parcels" DROP CONSTRAINT "FK_06d4bf6351355857f0de10f8000"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP CONSTRAINT "FK_31ebb1c306a184f45473426bec6"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP CONSTRAINT "FK_2ad5279e5e33e3c1eb58db96363"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP CONSTRAINT "FK_84d3757f0e4a20f86842a05a0a2"`);
        await queryRunner.query(`DROP TABLE "parcels"`);
        await queryRunner.query(`DROP TYPE "public"."parcels_payment_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."parcels_status_enum"`);
    }

}
