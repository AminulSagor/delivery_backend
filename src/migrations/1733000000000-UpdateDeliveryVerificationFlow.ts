import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Update Delivery Verification Flow
 * 
 * This migration adds support for:
 * 1. New parcel statuses: PARTIAL_DELIVERY, EXCHANGE, PAID_RETURN
 * 2. Enhanced delivery verification fields:
 *    - rider_id: Track which rider initiated the verification
 *    - selected_status: The delivery outcome status selected by rider
 *    - otp_recipient_type: Who receives OTP (MERCHANT or CUSTOMER)
 *    - otp_sent_to_phone: The phone number OTP was sent to
 *    - customer_phone_used: Customer's phone (for already-paid deliveries)
 *    - otp_verified_by: Who verified the OTP (for audit)
 */
export class UpdateDeliveryVerificationFlow1733000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add new parcel status enum values
    const enumName = 'parcels_status_enum';
    const newStatuses = [
      'PARTIAL_DELIVERY',
      'EXCHANGE',
      'PAID_RETURN',
      'RETURNED',
      'RETURN_TO_MERCHANT',
      'DELIVERY_RESCHEDULED',
    ];
    
    for (const status of newStatuses) {
      try {
        await queryRunner.query(`ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${status}'`);
        console.log(`Added status: ${status}`);
      } catch (e) {
        console.log(`${status} already exists or error:`, e.message);
      }
    }

    // 2. Create OTP recipient type enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_recipient_type_enum') THEN
          CREATE TYPE otp_recipient_type_enum AS ENUM ('MERCHANT', 'CUSTOMER');
        END IF;
      END
      $$;
    `);

    // 3. Add new columns to delivery_verifications table
    await queryRunner.query(`
      ALTER TABLE "delivery_verifications"
      ADD COLUMN IF NOT EXISTS "rider_id" uuid,
      ADD COLUMN IF NOT EXISTS "selected_status" varchar(50),
      ADD COLUMN IF NOT EXISTS "otp_recipient_type" otp_recipient_type_enum DEFAULT 'MERCHANT',
      ADD COLUMN IF NOT EXISTS "otp_sent_to_phone" varchar(20),
      ADD COLUMN IF NOT EXISTS "customer_phone_used" varchar(20),
      ADD COLUMN IF NOT EXISTS "otp_verified_by" otp_recipient_type_enum
    `);

    // 4. Add foreign key for rider_id
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_delivery_verifications_rider'
        ) THEN
          ALTER TABLE "delivery_verifications"
          ADD CONSTRAINT "FK_delivery_verifications_rider"
          FOREIGN KEY ("rider_id")
          REFERENCES "riders"("id")
          ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    // 5. Update existing records to have default values
    await queryRunner.query(`
      UPDATE "delivery_verifications"
      SET 
        "selected_status" = 'DELIVERED',
        "otp_recipient_type" = 'MERCHANT'
      WHERE "selected_status" IS NULL
    `);

    // 6. Make selected_status NOT NULL after setting defaults
    await queryRunner.query(`
      ALTER TABLE "delivery_verifications"
      ALTER COLUMN "selected_status" SET NOT NULL
    `);

    // 7. Set requires_otp_verification default to true
    await queryRunner.query(`
      ALTER TABLE "delivery_verifications"
      ALTER COLUMN "requires_otp_verification" SET DEFAULT true
    `);

    // 8. Create index on rider_id for better query performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_delivery_verifications_rider_id" 
      ON "delivery_verifications"("rider_id")
    `);

    console.log('[MIGRATION] UpdateDeliveryVerificationFlow completed successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_delivery_verifications_rider_id"`);

    // Drop foreign key
    await queryRunner.query(`
      ALTER TABLE "delivery_verifications"
      DROP CONSTRAINT IF EXISTS "FK_delivery_verifications_rider"
    `);

    // Drop new columns
    await queryRunner.query(`
      ALTER TABLE "delivery_verifications"
      DROP COLUMN IF EXISTS "rider_id",
      DROP COLUMN IF EXISTS "selected_status",
      DROP COLUMN IF EXISTS "otp_recipient_type",
      DROP COLUMN IF EXISTS "otp_sent_to_phone",
      DROP COLUMN IF EXISTS "customer_phone_used",
      DROP COLUMN IF EXISTS "otp_verified_by"
    `);

    // Note: We don't remove enum values as they might be in use
    // and PostgreSQL doesn't support removing enum values easily
    
    console.log('[MIGRATION] UpdateDeliveryVerificationFlow rolled back');
  }
}
