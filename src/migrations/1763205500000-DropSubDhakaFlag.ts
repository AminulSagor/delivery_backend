import { MigrationInterface, QueryRunner } from "typeorm";

export class DropSubDhakaFlag1763205500000 implements MigrationInterface {
    name = 'DropSubDhakaFlag1763205500000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "coverage_areas" DROP COLUMN IF EXISTS "sub_dhaka_flag"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "coverage_areas" ADD "sub_dhaka_flag" boolean NOT NULL DEFAULT false`);
    }
}
