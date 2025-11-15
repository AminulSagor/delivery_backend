import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateStoresTable1763192147590 implements MigrationInterface {
    name = 'CreateStoresTable1763192147590'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "merchants" DROP CONSTRAINT "FK_merchants_user_id"`);
        await queryRunner.query(`ALTER TABLE "merchants" DROP CONSTRAINT "FK_merchants_approved_by"`);
        await queryRunner.query(`ALTER TABLE "hubs" DROP CONSTRAINT "FK_hubs_manager_user_id"`);
        await queryRunner.query(`ALTER TABLE "riders" DROP CONSTRAINT "FK_riders_user_id"`);
        await queryRunner.query(`ALTER TABLE "riders" DROP CONSTRAINT "FK_riders_hub_id"`);
        await queryRunner.query(`ALTER TABLE "hub_managers" DROP CONSTRAINT "FK_hub_managers_user_id"`);
        await queryRunner.query(`ALTER TABLE "hub_managers" DROP CONSTRAINT "FK_hub_managers_hub_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_users_phone"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_users_email"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_hubs_hub_code"`);
        await queryRunner.query(`CREATE TABLE "stores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" uuid NOT NULL, "business_name" character varying(255) NOT NULL, "business_address" text NOT NULL, "phone_number" character varying(50) NOT NULL, "email" character varying(255), "facebook_page" character varying(255), "exchange_parcel" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7aa6e7d71fa7acdd7ca43d7c9cb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TYPE "public"."user_role_enum" RENAME TO "user_role_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'HUB_MANAGER', 'RIDER', 'MERCHANT')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum" USING "role"::"text"::"public"."users_role_enum"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'MERCHANT'`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."merchant_status_enum" RENAME TO "merchant_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."merchants_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`ALTER TABLE "merchants" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "merchants" ALTER COLUMN "status" TYPE "public"."merchants_status_enum" USING "status"::"text"::"public"."merchants_status_enum"`);
        await queryRunner.query(`ALTER TABLE "merchants" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."merchant_status_enum_old"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a000cca60bcf04454e72769949" ON "users" ("phone") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_28009822e8e1d2394345560f22" ON "hubs" ("hub_code") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f6370b41e2999df188ad92a1e5" ON "hub_managers" ("hub_id") `);
        await queryRunner.query(`ALTER TABLE "merchants" ADD CONSTRAINT "FK_698f612a3134c503f711479a4e5" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "merchants" ADD CONSTRAINT "FK_d46980a69ca4ba1462657942be4" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stores" ADD CONSTRAINT "FK_882687fd3a8a29fa5bf13858a5b" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hubs" ADD CONSTRAINT "FK_09d5650805493f30f069e749342" FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "riders" ADD CONSTRAINT "FK_8d3d41e9ec12eff82b325fa8c07" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "riders" ADD CONSTRAINT "FK_3b76d47a57c06bd04edfe99b629" FOREIGN KEY ("hub_id") REFERENCES "hubs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hub_managers" ADD CONSTRAINT "FK_912f1a7993073f2219c49a0ef85" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hub_managers" ADD CONSTRAINT "FK_f6370b41e2999df188ad92a1e59" FOREIGN KEY ("hub_id") REFERENCES "hubs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hub_managers" DROP CONSTRAINT "FK_f6370b41e2999df188ad92a1e59"`);
        await queryRunner.query(`ALTER TABLE "hub_managers" DROP CONSTRAINT "FK_912f1a7993073f2219c49a0ef85"`);
        await queryRunner.query(`ALTER TABLE "riders" DROP CONSTRAINT "FK_3b76d47a57c06bd04edfe99b629"`);
        await queryRunner.query(`ALTER TABLE "riders" DROP CONSTRAINT "FK_8d3d41e9ec12eff82b325fa8c07"`);
        await queryRunner.query(`ALTER TABLE "hubs" DROP CONSTRAINT "FK_09d5650805493f30f069e749342"`);
        await queryRunner.query(`ALTER TABLE "stores" DROP CONSTRAINT "FK_882687fd3a8a29fa5bf13858a5b"`);
        await queryRunner.query(`ALTER TABLE "merchants" DROP CONSTRAINT "FK_d46980a69ca4ba1462657942be4"`);
        await queryRunner.query(`ALTER TABLE "merchants" DROP CONSTRAINT "FK_698f612a3134c503f711479a4e5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f6370b41e2999df188ad92a1e5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_28009822e8e1d2394345560f22"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a000cca60bcf04454e72769949"`);
        await queryRunner.query(`CREATE TYPE "public"."merchant_status_enum_old" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`ALTER TABLE "merchants" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "merchants" ALTER COLUMN "status" TYPE "public"."merchant_status_enum_old" USING "status"::"text"::"public"."merchant_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "merchants" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."merchants_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."merchant_status_enum_old" RENAME TO "merchant_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum_old" AS ENUM('ADMIN', 'HUB_MANAGER', 'RIDER', 'MERCHANT')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."user_role_enum_old" USING "role"::"text"::"public"."user_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'MERCHANT'`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."user_role_enum_old" RENAME TO "user_role_enum"`);
        await queryRunner.query(`DROP TABLE "stores"`);
        await queryRunner.query(`CREATE INDEX "IDX_hubs_hub_code" ON "hubs" ("hub_code") `);
        await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_users_phone" ON "users" ("phone") `);
        await queryRunner.query(`ALTER TABLE "hub_managers" ADD CONSTRAINT "FK_hub_managers_hub_id" FOREIGN KEY ("hub_id") REFERENCES "hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "hub_managers" ADD CONSTRAINT "FK_hub_managers_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "riders" ADD CONSTRAINT "FK_riders_hub_id" FOREIGN KEY ("hub_id") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "riders" ADD CONSTRAINT "FK_riders_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "hubs" ADD CONSTRAINT "FK_hubs_manager_user_id" FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "merchants" ADD CONSTRAINT "FK_merchants_approved_by" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "merchants" ADD CONSTRAINT "FK_merchants_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

}
