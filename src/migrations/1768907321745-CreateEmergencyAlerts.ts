import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEmergencyAlerts1768907321745 implements MigrationInterface {
    name = 'CreateEmergencyAlerts1768907321745'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."emergency_alerts_type_enum" AS ENUM('ACCIDENT', 'ROBBERY_THEFT', 'VEHICLE_BREAKDOWN', 'UNSAFE_THREAT', 'LOST_DEVICE', 'OTHER')`);
        await queryRunner.query(`CREATE TYPE "public"."emergency_alerts_status_enum" AS ENUM('PENDING', 'IN_PROGRESS', 'RESOLVED')`);
        await queryRunner.query(`CREATE TABLE "emergency_alerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "rider_id" uuid NOT NULL, "hub_id" uuid NOT NULL, "type" "public"."emergency_alerts_type_enum" NOT NULL, "description" text, "latitude" numeric(10,8), "longitude" numeric(11,8), "location_address" text, "status" "public"."emergency_alerts_status_enum" NOT NULL DEFAULT 'PENDING', "resolved_by_id" uuid, "resolution_notes" text, "resolved_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c0a1cae4572ece44529b12f4583" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_98d190d714760f3a2fca40df7c" ON "emergency_alerts" ("hub_id", "status") `);
        await queryRunner.query(`ALTER TABLE "pricing_configurations" ALTER COLUMN "weight_step_kg" SET DEFAULT '0.5'`);
        await queryRunner.query(`ALTER TABLE "emergency_alerts" ADD CONSTRAINT "FK_cb3609c21c306a6305e89aa2667" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "emergency_alerts" ADD CONSTRAINT "FK_caef0a546cfca6ce8c6fe7668b8" FOREIGN KEY ("hub_id") REFERENCES "hubs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "emergency_alerts" ADD CONSTRAINT "FK_e53ba86fca16afe7ef2f2ca8318" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "emergency_alerts" DROP CONSTRAINT "FK_e53ba86fca16afe7ef2f2ca8318"`);
        await queryRunner.query(`ALTER TABLE "emergency_alerts" DROP CONSTRAINT "FK_caef0a546cfca6ce8c6fe7668b8"`);
        await queryRunner.query(`ALTER TABLE "emergency_alerts" DROP CONSTRAINT "FK_cb3609c21c306a6305e89aa2667"`);
        await queryRunner.query(`ALTER TABLE "pricing_configurations" ALTER COLUMN "weight_step_kg" SET DEFAULT 0.5`);
        await queryRunner.query(`DROP INDEX "public"."IDX_98d190d714760f3a2fca40df7c"`);
        await queryRunner.query(`DROP TABLE "emergency_alerts"`);
        await queryRunner.query(`DROP TYPE "public"."emergency_alerts_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."emergency_alerts_type_enum"`);
    }

}
