import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTypeOrmMetadataTable1736523600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the typeorm_metadata table that TypeORM uses for tracking
    // generated columns, views, and other metadata
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "typeorm_metadata" (
        "type" varchar(255) NOT NULL,
        "database" varchar(255) DEFAULT NULL,
        "schema" varchar(255) DEFAULT NULL,
        "table" varchar(255) DEFAULT NULL,
        "name" varchar(255) DEFAULT NULL,
        "value" text
      );
    `);

    // Insert metadata for the existing generated column in delivery_verifications
    await queryRunner.query(`
      INSERT INTO "typeorm_metadata" ("type", "database", "schema", "table", "name", "value")
      VALUES ('GENERATED_COLUMN', current_database(), 'public', 'delivery_verifications', 'amount_difference', 'collected_amount - expected_cod_amount')
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "typeorm_metadata";`);
  }
}

