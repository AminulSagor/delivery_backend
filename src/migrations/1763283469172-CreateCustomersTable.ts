import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCustomersTable1763283469172 implements MigrationInterface {
    name = 'CreateCustomersTable1763283469172'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "parcels" DROP CONSTRAINT "FK_9c8e7e7e0e7e7e7e7e7e7e7e7e7"`);
        await queryRunner.query(`CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "customer_name" character varying(255) NOT NULL, "phone_number" character varying(50) NOT NULL, "secondary_number" character varying(50), "delivery_address" text NOT NULL, CONSTRAINT "UQ_46c5f573cb24bdc6e81b8ef2504" UNIQUE ("phone_number"), CONSTRAINT "UQ_6bc09826e09c8a26cdeb323697b" UNIQUE ("secondary_number"), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD CONSTRAINT "FK_06d4bf6351355857f0de10f8000" FOREIGN KEY ("delivery_coverage_area_id") REFERENCES "coverage_areas"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "parcels" DROP CONSTRAINT "FK_06d4bf6351355857f0de10f8000"`);
        await queryRunner.query(`DROP TABLE "customers"`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD CONSTRAINT "FK_9c8e7e7e0e7e7e7e7e7e7e7e7e7" FOREIGN KEY ("delivery_coverage_area_id") REFERENCES "coverage_areas"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
