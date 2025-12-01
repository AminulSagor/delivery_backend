import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateParcelTable1763291344115 implements MigrationInterface {
    name = 'UpdateParcelTable1763291344115'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "parcels" DROP CONSTRAINT "FK_31ebb1c306a184f45473426bec6"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "pickup_coverage_area_id"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "pickup_store_name"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "pickup_phone"`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD "customer_id" uuid`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD CONSTRAINT "FK_5e9a1bd301b733770a4afd3648c" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "parcels" DROP CONSTRAINT "FK_5e9a1bd301b733770a4afd3648c"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "customer_id"`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD "pickup_phone" character varying(20) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD "pickup_store_name" character varying(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD "pickup_coverage_area_id" uuid`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD CONSTRAINT "FK_31ebb1c306a184f45473426bec6" FOREIGN KEY ("pickup_coverage_area_id") REFERENCES "coverage_areas"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
