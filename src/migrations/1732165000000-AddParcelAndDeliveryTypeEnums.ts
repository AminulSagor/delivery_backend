import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParcelAndDeliveryTypeEnums1732165000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Note: Using simple SMALLINT instead of enums for better flexibility
    // Parcel Types: 1=Parcel, 2=Book, 3=Document
    // Delivery Types: 1=Normal, 2=Express, 3=Same Day

    // Backup existing parcel_type data if column exists
    const parcelTypeExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='parcels' AND column_name='parcel_type'
    `);

    if (parcelTypeExists.length > 0) {
      await queryRunner.query(`
        ALTER TABLE "parcels" 
        ADD COLUMN IF NOT EXISTS "parcel_type_old" VARCHAR(50)
      `);

      await queryRunner.query(`
        UPDATE "parcels" 
        SET "parcel_type_old" = "parcel_type"
        WHERE "parcel_type" IS NOT NULL
      `);

      await queryRunner.query(`
        ALTER TABLE "parcels" 
        DROP COLUMN "parcel_type"
      `);
    }

    // Add new parcel_type column as SMALLINT
    await queryRunner.query(`
      ALTER TABLE "parcels"
      ADD COLUMN IF NOT EXISTS "parcel_type" SMALLINT
    `);

    // Migrate old data if backup exists (best effort mapping)
    await queryRunner.query(`
      UPDATE "parcels"
      SET "parcel_type" = CASE
        WHEN UPPER("parcel_type_old") LIKE '%BOOK%' THEN 2
        WHEN UPPER("parcel_type_old") LIKE '%DOCUMENT%' THEN 3
        ELSE 1  -- Default to Parcel
      END
      WHERE "parcel_type_old" IS NOT NULL AND "parcel_type" IS NULL
    `);

    // Drop backup column if exists
    await queryRunner.query(`
      ALTER TABLE "parcels" 
      DROP COLUMN IF EXISTS "parcel_type_old"
    `);

    // Add delivery_type column as SMALLINT with default 1 (Normal)
    await queryRunner.query(`
      ALTER TABLE "parcels"
      ADD COLUMN IF NOT EXISTS "delivery_type" SMALLINT DEFAULT 1 NOT NULL
    `);

    // Add check constraints to ensure only valid values (1, 2, 3)
    await queryRunner.query(`
      ALTER TABLE "parcels"
      ADD CONSTRAINT "CHK_parcel_type_valid" 
      CHECK ("parcel_type" IS NULL OR "parcel_type" IN (1, 2, 3))
    `);

    await queryRunner.query(`
      ALTER TABLE "parcels"
      ADD CONSTRAINT "CHK_delivery_type_valid" 
      CHECK ("delivery_type" IN (1, 2, 3))
    `);

    // Create indexes for efficient queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_parcels_parcel_type" ON "parcels"("parcel_type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_parcels_delivery_type" ON "parcels"("delivery_type")
    `);

    // Add comments for documentation
    await queryRunner.query(`
      COMMENT ON COLUMN "parcels"."parcel_type" IS 'Parcel type: 1=Parcel, 2=Book, 3=Document'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "parcels"."delivery_type" IS 'Delivery type: 1=Normal, 2=Express, 3=Same Day'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop constraints
    await queryRunner.query(`ALTER TABLE "parcels" DROP CONSTRAINT IF EXISTS "CHK_delivery_type_valid"`);
    await queryRunner.query(`ALTER TABLE "parcels" DROP CONSTRAINT IF EXISTS "CHK_parcel_type_valid"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_parcels_delivery_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_parcels_parcel_type"`);

    // Drop new columns
    await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN IF EXISTS "delivery_type"`);
    await queryRunner.query(`ALTER TABLE "parcels" DROP COLUMN IF EXISTS "parcel_type"`);

    // Note: Old parcel_type column restoration would need to be done manually
    // as we don't have the old data anymore
  }
}
