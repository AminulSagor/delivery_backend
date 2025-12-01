import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateParcelsTable1763203301515 implements MigrationInterface {
    name = 'CreateParcelsTable1763203301515'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "coverage_areas" DROP CONSTRAINT "PK_0176a96d781b8cfa1723b2929f1"`);
        await queryRunner.query(`ALTER TABLE "coverage_areas" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "coverage_areas" ADD "id" SERIAL NOT NULL`);
        await queryRunner.query(`ALTER TABLE "coverage_areas" ADD CONSTRAINT "PK_0176a96d781b8cfa1723b2929f1" PRIMARY KEY ("id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "coverage_areas" DROP CONSTRAINT "PK_0176a96d781b8cfa1723b2929f1"`);
        await queryRunner.query(`ALTER TABLE "coverage_areas" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "coverage_areas" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "coverage_areas" ADD CONSTRAINT "PK_0176a96d781b8cfa1723b2929f1" PRIMARY KEY ("id")`);
    }

}
