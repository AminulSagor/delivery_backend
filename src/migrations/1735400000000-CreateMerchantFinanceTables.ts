import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMerchantFinanceTables1735400000000 implements MigrationInterface {
  name = 'CreateMerchantFinanceTables1735400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "finance_transaction_type_enum" AS ENUM ('CREDIT', 'DEBIT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "finance_reference_type_enum" AS ENUM (
          'PARCEL_DELIVERED',
          'PARCEL_PARTIAL_DELIVERY',
          'PARCEL_EXCHANGE',
          'PARCEL_PAID_RETURN',
          'ADJUSTMENT_CREDIT',
          'REFUND',
          'DELIVERY_CHARGE',
          'RETURN_CHARGE',
          'INVOICE_PAID',
          'WITHDRAWAL',
          'ADJUSTMENT_DEBIT',
          'CLEARANCE'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create merchant_finances table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "merchant_finances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "merchant_id" uuid NOT NULL,
        "current_balance" decimal(12,2) NOT NULL DEFAULT 0,
        "pending_balance" decimal(12,2) NOT NULL DEFAULT 0,
        "invoiced_balance" decimal(12,2) NOT NULL DEFAULT 0,
        "processing_balance" decimal(12,2) NOT NULL DEFAULT 0,
        "hold_amount" decimal(12,2) NOT NULL DEFAULT 0,
        "total_earned" decimal(12,2) NOT NULL DEFAULT 0,
        "total_withdrawn" decimal(12,2) NOT NULL DEFAULT 0,
        "total_delivery_charges" decimal(12,2) NOT NULL DEFAULT 0,
        "total_return_charges" decimal(12,2) NOT NULL DEFAULT 0,
        "total_cod_collected" decimal(12,2) NOT NULL DEFAULT 0,
        "total_parcels_delivered" integer NOT NULL DEFAULT 0,
        "total_parcels_returned" integer NOT NULL DEFAULT 0,
        "credit_limit" decimal(12,2) NOT NULL DEFAULT 0,
        "credit_used" decimal(12,2) NOT NULL DEFAULT 0,
        "last_transaction_at" TIMESTAMP,
        "last_withdrawal_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_merchant_finances" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_merchant_finances_merchant_id" UNIQUE ("merchant_id"),
        CONSTRAINT "FK_merchant_finances_user" FOREIGN KEY ("merchant_id") 
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    // Create index on merchant_finances
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_merchant_finances_merchant_id" 
      ON "merchant_finances" ("merchant_id");
    `);

    // Create merchant_finance_transactions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "merchant_finance_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "merchant_id" uuid NOT NULL,
        "transaction_type" "finance_transaction_type_enum" NOT NULL,
        "amount" decimal(12,2) NOT NULL,
        "balance_after" decimal(12,2) NOT NULL,
        "balance_before" decimal(12,2) NOT NULL,
        "reference_type" "finance_reference_type_enum" NOT NULL,
        "reference_id" uuid,
        "reference_code" varchar(100),
        "description" text,
        "notes" text,
        "cod_amount" decimal(12,2),
        "delivery_charge" decimal(12,2),
        "return_charge" decimal(12,2),
        "created_by" uuid,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_merchant_finance_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_merchant_finance_transactions_finance" FOREIGN KEY ("merchant_id") 
          REFERENCES "merchant_finances"("merchant_id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_merchant_finance_transactions_creator" FOREIGN KEY ("created_by") 
          REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      );
    `);

    // Create indexes on merchant_finance_transactions
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_merchant_finance_txn_merchant_created" 
      ON "merchant_finance_transactions" ("merchant_id", "created_at");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_merchant_finance_txn_reference" 
      ON "merchant_finance_transactions" ("reference_type", "reference_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_merchant_finance_txn_type" 
      ON "merchant_finance_transactions" ("transaction_type");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_merchant_finance_txn_created_at" 
      ON "merchant_finance_transactions" ("created_at");
    `);

    console.log('✅ Created merchant_finances and merchant_finance_transactions tables');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_merchant_finance_txn_created_at";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_merchant_finance_txn_type";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_merchant_finance_txn_reference";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_merchant_finance_txn_merchant_created";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_merchant_finances_merchant_id";`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "merchant_finance_transactions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "merchant_finances";`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "finance_reference_type_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "finance_transaction_type_enum";`);

    console.log('❌ Dropped merchant_finances and merchant_finance_transactions tables');
  }
}

