import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1699999999999 implements MigrationInterface {
  name = 'InitialSchema1699999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM('ADMIN', 'HUB_MANAGER', 'RIDER', 'MERCHANT')
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "full_name" character varying(255) NOT NULL,
        "phone" character varying(50) NOT NULL,
        "email" character varying(255),
        "password_hash" character varying(255) NOT NULL,
        "role" "user_role_enum" NOT NULL DEFAULT 'MERCHANT',
        "is_active" boolean NOT NULL DEFAULT true,
        "refresh_token" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_phone" UNIQUE ("phone"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_phone" ON "users" ("phone")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_email" ON "users" ("email")
    `);

    // Create hubs table
    await queryRunner.query(`
      CREATE TABLE "hubs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hub_code" character varying(50) NOT NULL,
        "branch_name" character varying(255) NOT NULL,
        "area" character varying(255) NOT NULL,
        "address" text NOT NULL,
        "manager_name" character varying(255) NOT NULL,
        "manager_phone" character varying(50) NOT NULL,
        "manager_user_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hubs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_hubs_hub_code" UNIQUE ("hub_code"),
        CONSTRAINT "FK_hubs_manager_user_id" FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_hubs_hub_code" ON "hubs" ("hub_code")
    `);

    // Create hub_managers table
    await queryRunner.query(`
      CREATE TABLE "hub_managers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "hub_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hub_managers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_hub_managers_hub_id" UNIQUE ("hub_id"),
        CONSTRAINT "FK_hub_managers_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_hub_managers_hub_id" FOREIGN KEY ("hub_id") REFERENCES "hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    // Create riders table
    await queryRunner.query(`
      CREATE TABLE "riders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "hub_id" uuid NOT NULL,
        "license_no" character varying(100),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_riders" PRIMARY KEY ("id"),
        CONSTRAINT "FK_riders_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_riders_hub_id" FOREIGN KEY ("hub_id") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);

    // Create merchants table
    await queryRunner.query(`
      CREATE TYPE "merchant_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')
    `);

    await queryRunner.query(`
      CREATE TABLE "merchants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "thana" character varying(255) NOT NULL,
        "district" character varying(255) NOT NULL,
        "full_address" text,
        "secondary_number" character varying(50),
        "status" "merchant_status_enum" NOT NULL DEFAULT 'PENDING',
        "approved_at" TIMESTAMP,
        "approved_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_merchants" PRIMARY KEY ("id"),
        CONSTRAINT "FK_merchants_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_merchants_approved_by" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "merchants"`);
    await queryRunner.query(`DROP TYPE "merchant_status_enum"`);
    await queryRunner.query(`DROP TABLE "riders"`);
    await queryRunner.query(`DROP TABLE "hub_managers"`);
    await queryRunner.query(`DROP TABLE "hubs"`);
    await queryRunner.query(`DROP INDEX "IDX_users_email"`);
    await queryRunner.query(`DROP INDEX "IDX_users_phone"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
  }
}
