import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCarrybeeIntegration1732450000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create delivery_provider enum
    await queryRunner.query(`
      CREATE TYPE "delivery_provider_enum" AS ENUM ('INTERNAL', 'CARRYBEE')
    `);

    // 2. Create third_party_providers table
    await queryRunner.query(`
      CREATE TABLE "third_party_providers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "provider_code" varchar(50) UNIQUE NOT NULL,
        "provider_name" varchar(100) NOT NULL,
        "description" text,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `);

    // 3. Add location fields to stores table
    await queryRunner.query(`
      ALTER TABLE "stores"
      ADD COLUMN "district" varchar(100),
      ADD COLUMN "thana" varchar(100),
      ADD COLUMN "area" varchar(100),
      ADD COLUMN "carrybee_store_id" varchar(100),
      ADD COLUMN "carrybee_city_id" int,
      ADD COLUMN "carrybee_zone_id" int,
      ADD COLUMN "carrybee_area_id" int,
      ADD COLUMN "is_carrybee_synced" boolean DEFAULT false,
      ADD COLUMN "carrybee_synced_at" timestamp
    `);

    // 4. Add ASSIGNED_TO_THIRD_PARTY to parcel_status enum
    // Find the correct enum name
    const enumCheck = await queryRunner.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typname LIKE '%parcel%status%' OR typname LIKE '%parcels%status%'
    `);
    
    let enumName = 'parcels_status_enum'; // Default TypeORM naming
    if (enumCheck && enumCheck.length > 0) {
      enumName = enumCheck[0].typname;
    }
    
    console.log(`Using enum name: ${enumName}`);
    
    try {
      await queryRunner.query(`ALTER TYPE "${enumName}" ADD VALUE 'ASSIGNED_TO_THIRD_PARTY'`);
    } catch (e) {
      console.log('ASSIGNED_TO_THIRD_PARTY already exists or error:', e.message);
    }

    // 5. Add third-party delivery fields to parcels table
    await queryRunner.query(`
      ALTER TABLE "parcels"
      ADD COLUMN "delivery_provider" delivery_provider_enum DEFAULT 'INTERNAL',
      ADD COLUMN "third_party_provider_id" uuid,
      ADD COLUMN "carrybee_consignment_id" varchar(100),
      ADD COLUMN "carrybee_delivery_fee" decimal(10,2),
      ADD COLUMN "carrybee_cod_fee" decimal(10,2),
      ADD COLUMN "assigned_to_carrybee_at" timestamp,
      ADD CONSTRAINT "FK_parcels_third_party_provider" 
        FOREIGN KEY ("third_party_provider_id") 
        REFERENCES "third_party_providers"("id") 
        ON DELETE SET NULL
    `);

    // 6. Seed Carrybee provider
    await queryRunner.query(`
      INSERT INTO "third_party_providers" 
      ("provider_code", "provider_name", "description", "is_active")
      VALUES 
      ('CARRYBEE', 'Carrybee', 'Third-party delivery service provider', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove fields from parcels
    await queryRunner.query(`
      ALTER TABLE "parcels"
      DROP CONSTRAINT "FK_parcels_third_party_provider",
      DROP COLUMN "assigned_to_carrybee_at",
      DROP COLUMN "carrybee_cod_fee",
      DROP COLUMN "carrybee_delivery_fee",
      DROP COLUMN "carrybee_consignment_id",
      DROP COLUMN "third_party_provider_id",
      DROP COLUMN "delivery_provider"
    `);

    // Remove fields from stores
    await queryRunner.query(`
      ALTER TABLE "stores"
      DROP COLUMN "carrybee_synced_at",
      DROP COLUMN "is_carrybee_synced",
      DROP COLUMN "carrybee_area_id",
      DROP COLUMN "carrybee_zone_id",
      DROP COLUMN "carrybee_city_id",
      DROP COLUMN "carrybee_store_id",
      DROP COLUMN "area",
      DROP COLUMN "thana",
      DROP COLUMN "district"
    `);

    // Drop third_party_providers table
    await queryRunner.query(`DROP TABLE "third_party_providers"`);

    // Drop delivery_provider enum
    await queryRunner.query(`DROP TYPE "delivery_provider_enum"`);
  }
}
