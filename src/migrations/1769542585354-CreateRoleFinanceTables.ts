import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRoleFinanceTables1769542585354
  implements MigrationInterface
{
  name = 'CreateRoleFinanceTables1769542585354';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "rider_finances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "rider_id" uuid NOT NULL, "current_balance" numeric(12,2) NOT NULL DEFAULT '0', "total_collected_amount" numeric(12,2) NOT NULL DEFAULT '0', "total_deposited_amount" numeric(12,2) NOT NULL DEFAULT '0', "total_earnings" numeric(12,2) NOT NULL DEFAULT '0', "pending_balance" numeric(12,2) NOT NULL DEFAULT '0', "last_settlement_at" TIMESTAMP, "last_collection_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fc37693fd37b18b58487a4cbbfe" UNIQUE ("rider_id"), CONSTRAINT "REL_fc37693fd37b18b58487a4cbbf" UNIQUE ("rider_id"), CONSTRAINT "PK_cb95956094db2d09c83aa6c48dc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_fc37693fd37b18b58487a4cbbf" ON "rider_finances" ("rider_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "hub_manager_finances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "hub_manager_id" uuid NOT NULL, "hub_id" uuid NOT NULL, "current_balance" numeric(12,2) NOT NULL DEFAULT '0', "total_collected_from_riders" numeric(12,2) NOT NULL DEFAULT '0', "total_transferred_to_admin" numeric(12,2) NOT NULL DEFAULT '0', "last_collection_at" TIMESTAMP, "last_transfer_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_83b02c9c95ac678b150336cb8fc" UNIQUE ("hub_manager_id"), CONSTRAINT "REL_83b02c9c95ac678b150336cb8f" UNIQUE ("hub_manager_id"), CONSTRAINT "PK_fa89235e4d5c19947d7b455d63b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_85af534fbb6317bf064a08b150" ON "hub_manager_finances" ("hub_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_83b02c9c95ac678b150336cb8f" ON "hub_manager_finances" ("hub_manager_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "admin_finances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "admin_id" uuid NOT NULL, "current_system_balance" numeric(15,2) NOT NULL DEFAULT '0', "total_revenue" numeric(15,2) NOT NULL DEFAULT '0', "total_collected_from_hubs" numeric(15,2) NOT NULL DEFAULT '0', "total_paid_to_merchants" numeric(15,2) NOT NULL DEFAULT '0', "last_collection_at" TIMESTAMP, "last_payout_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fad904c2f6d283233af7b4ec4fe" UNIQUE ("admin_id"), CONSTRAINT "REL_fad904c2f6d283233af7b4ec4f" UNIQUE ("admin_id"), CONSTRAINT "PK_8510888e4aa5a880a79cd3ad014" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_fad904c2f6d283233af7b4ec4f" ON "admin_finances" ("admin_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_configurations" ALTER COLUMN "weight_step_kg" SET DEFAULT '0.5'`,
    );
    await queryRunner.query(
      `ALTER TABLE "rider_finances" ADD CONSTRAINT "FK_fc37693fd37b18b58487a4cbbfe" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hub_manager_finances" ADD CONSTRAINT "FK_83b02c9c95ac678b150336cb8fc" FOREIGN KEY ("hub_manager_id") REFERENCES "hub_managers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hub_manager_finances" ADD CONSTRAINT "FK_85af534fbb6317bf064a08b150a" FOREIGN KEY ("hub_id") REFERENCES "hubs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_finances" ADD CONSTRAINT "FK_fad904c2f6d283233af7b4ec4fe" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin_finances" DROP CONSTRAINT "FK_fad904c2f6d283233af7b4ec4fe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hub_manager_finances" DROP CONSTRAINT "FK_85af534fbb6317bf064a08b150a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hub_manager_finances" DROP CONSTRAINT "FK_83b02c9c95ac678b150336cb8fc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rider_finances" DROP CONSTRAINT "FK_fc37693fd37b18b58487a4cbbfe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_configurations" ALTER COLUMN "weight_step_kg" SET DEFAULT 0.5`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fad904c2f6d283233af7b4ec4f"`,
    );
    await queryRunner.query(`DROP TABLE "admin_finances"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_83b02c9c95ac678b150336cb8f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_85af534fbb6317bf064a08b150"`,
    );
    await queryRunner.query(`DROP TABLE "hub_manager_finances"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fc37693fd37b18b58487a4cbbf"`,
    );
    await queryRunner.query(`DROP TABLE "rider_finances"`);
  }
}
