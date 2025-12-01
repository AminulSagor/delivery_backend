import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWeightChargeColumn1763204131658 implements MigrationInterface {
    name = 'AddWeightChargeColumn1763204131658'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "parcels" ADD "weight_charge" numeric(10,2) NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN "weight_charge"`);
    }

}
