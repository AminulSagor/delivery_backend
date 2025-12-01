import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParcelStatusEnums1732101000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if enum exists and get its name
    const enumCheck = await queryRunner.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typname LIKE '%parcel%status%' OR typname LIKE '%parcels%status%'
    `);
    
    console.log('Found enum types:', enumCheck);
    
    // Try to find the correct enum name
    let enumName = 'parcels_status_enum'; // Default TypeORM naming
    
    if (enumCheck && enumCheck.length > 0) {
      enumName = enumCheck[0].typname;
    }
    
    console.log(`Using enum name: ${enumName}`);
    
    // Add new values one by one (IF NOT EXISTS doesn't work in transactions)
    try {
      await queryRunner.query(`ALTER TYPE "${enumName}" ADD VALUE 'ASSIGNED_TO_RIDER'`);
    } catch (e) {
      console.log('ASSIGNED_TO_RIDER already exists or error:', e.message);
    }
    
    try {
      await queryRunner.query(`ALTER TYPE "${enumName}" ADD VALUE 'OUT_FOR_DELIVERY'`);
    } catch (e) {
      console.log('OUT_FOR_DELIVERY already exists or error:', e.message);
    }
    
    try {
      await queryRunner.query(`ALTER TYPE "${enumName}" ADD VALUE 'OUT_FOR_PICKUP'`);
    } catch (e) {
      console.log('OUT_FOR_PICKUP already exists or error:', e.message);
    }
    
    try {
      await queryRunner.query(`ALTER TYPE "${enumName}" ADD VALUE 'FAILED_DELIVERY'`);
    } catch (e) {
      console.log('FAILED_DELIVERY already exists or error:', e.message);
    }
    
    try {
      await queryRunner.query(`ALTER TYPE "${enumName}" ADD VALUE 'RETURNED_TO_HUB'`);
    } catch (e) {
      console.log('RETURNED_TO_HUB already exists or error:', e.message);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cannot remove enum values in PostgreSQL without recreating the enum
    // This is intentionally left empty as removing enum values requires
    // dropping and recreating the entire enum type
  }
}
