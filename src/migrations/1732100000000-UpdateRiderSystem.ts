import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateRiderSystem1732100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create bike_type enum first
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE bike_type_enum AS ENUM ('BICYCLE', 'MOTORCYCLE', 'SCOOTER', 'VAN');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add new columns to riders table
    await queryRunner.query(`
      ALTER TABLE riders
      ADD COLUMN IF NOT EXISTS photo VARCHAR(500),
      ADD COLUMN IF NOT EXISTS guardian_mobile_no VARCHAR(20),
      ADD COLUMN IF NOT EXISTS nid_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS present_address TEXT,
      ADD COLUMN IF NOT EXISTS permanent_address TEXT,
      ADD COLUMN IF NOT EXISTS fixed_salary DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS nid_front_photo VARCHAR(500),
      ADD COLUMN IF NOT EXISTS nid_back_photo VARCHAR(500),
      ADD COLUMN IF NOT EXISTS license_front_photo VARCHAR(500),
      ADD COLUMN IF NOT EXISTS license_back_photo VARCHAR(500),
      ADD COLUMN IF NOT EXISTS parent_nid_front_photo VARCHAR(500),
      ADD COLUMN IF NOT EXISTS parent_nid_back_photo VARCHAR(500);
    `);

    // Add bike_type column with enum type
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'riders' AND column_name = 'bike_type'
        ) THEN
          ALTER TABLE riders ADD COLUMN bike_type bike_type_enum DEFAULT 'MOTORCYCLE';
        END IF;
      END $$;
    `);

    // Add unique constraint to nid_number if not exists
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_riders_nid_number'
        ) THEN
          ALTER TABLE riders ADD CONSTRAINT UQ_riders_nid_number UNIQUE (nid_number);
        END IF;
      END $$;
    `);

    // Add rider assignment columns to parcels table
    await queryRunner.query(`
      ALTER TABLE parcels
      ADD COLUMN IF NOT EXISTS assigned_rider_id UUID,
      ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS rider_accepted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS out_for_delivery_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS return_reason TEXT;
    `);

    // Add foreign key constraint for parcels.assigned_rider_id
    await queryRunner.query(`
      ALTER TABLE parcels
      ADD CONSTRAINT fk_parcel_assigned_rider 
      FOREIGN KEY (assigned_rider_id) 
      REFERENCES riders(id) 
      ON DELETE SET NULL;
    `);

    // Add rider assignment columns to pickup_requests table
    await queryRunner.query(`
      ALTER TABLE pickup_requests
      ADD COLUMN IF NOT EXISTS assigned_rider_id UUID,
      ADD COLUMN IF NOT EXISTS rider_assigned_at TIMESTAMP;
    `);

    // Add foreign key constraint for pickup_requests.assigned_rider_id
    await queryRunner.query(`
      ALTER TABLE pickup_requests
      ADD CONSTRAINT fk_pickup_assigned_rider 
      FOREIGN KEY (assigned_rider_id) 
      REFERENCES riders(id) 
      ON DELETE SET NULL;
    `);

    // Note: Parcel status enum will be automatically updated by TypeORM
    // when the application starts due to synchronize or schema:sync
    // The new enum values are: ASSIGNED_TO_RIDER, OUT_FOR_DELIVERY, OUT_FOR_PICKUP,
    // FAILED_DELIVERY, RETURNED_TO_HUB
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraints
    await queryRunner.query(`
      ALTER TABLE parcels DROP CONSTRAINT IF EXISTS fk_parcel_assigned_rider;
    `);

    await queryRunner.query(`
      ALTER TABLE pickup_requests DROP CONSTRAINT IF EXISTS fk_pickup_assigned_rider;
    `);

    // Remove columns from parcels
    await queryRunner.query(`
      ALTER TABLE parcels
      DROP COLUMN IF EXISTS assigned_rider_id,
      DROP COLUMN IF EXISTS assigned_at,
      DROP COLUMN IF EXISTS rider_accepted_at,
      DROP COLUMN IF EXISTS out_for_delivery_at,
      DROP COLUMN IF EXISTS return_reason;
    `);

    // Remove columns from pickup_requests
    await queryRunner.query(`
      ALTER TABLE pickup_requests
      DROP COLUMN IF EXISTS assigned_rider_id,
      DROP COLUMN IF EXISTS rider_assigned_at;
    `);

    // Remove columns from riders
    await queryRunner.query(`
      ALTER TABLE riders
      DROP COLUMN IF EXISTS photo,
      DROP COLUMN IF EXISTS guardian_mobile_no,
      DROP COLUMN IF EXISTS bike_type,
      DROP COLUMN IF EXISTS nid_number,
      DROP COLUMN IF EXISTS present_address,
      DROP COLUMN IF EXISTS permanent_address,
      DROP COLUMN IF EXISTS fixed_salary,
      DROP COLUMN IF EXISTS commission_percentage,
      DROP COLUMN IF EXISTS nid_front_photo,
      DROP COLUMN IF EXISTS nid_back_photo,
      DROP COLUMN IF EXISTS license_front_photo,
      DROP COLUMN IF EXISTS license_back_photo,
      DROP COLUMN IF EXISTS parent_nid_front_photo,
      DROP COLUMN IF EXISTS parent_nid_back_photo;
    `);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS bike_type_enum;`);
  }
}
