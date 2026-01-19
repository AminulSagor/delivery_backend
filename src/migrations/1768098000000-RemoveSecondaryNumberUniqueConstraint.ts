import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveSecondaryNumberUniqueConstraint1768098000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the unique constraint on secondary_number
    // The constraint name may vary, so we'll find and drop it dynamically
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name_var TEXT;
      BEGIN
        SELECT constraint_name INTO constraint_name_var
        FROM information_schema.table_constraints
        WHERE table_name = 'customers'
          AND constraint_type = 'UNIQUE'
          AND constraint_name LIKE '%secondary_number%'
        LIMIT 1;
        
        IF constraint_name_var IS NOT NULL THEN
          EXECUTE 'ALTER TABLE "customers" DROP CONSTRAINT "' || constraint_name_var || '"';
        END IF;
      END $$;
    `);

    // Also try dropping by known constraint name from original migration
    await queryRunner.query(`
      ALTER TABLE "customers" 
      DROP CONSTRAINT IF EXISTS "UQ_6bc09826e09c8a26cdeb323697b"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add unique constraint on secondary_number
    // Note: This may fail if there are duplicate values
    await queryRunner.query(`
      ALTER TABLE "customers" 
      ADD CONSTRAINT "UQ_customers_secondary_number" 
      UNIQUE ("secondary_number")
    `);
  }
}

