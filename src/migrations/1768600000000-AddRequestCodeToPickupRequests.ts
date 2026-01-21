import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequestCodeToPickupRequests1768600000000 implements MigrationInterface {
  name = 'AddRequestCodeToPickupRequests1768600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column already exists
    const hasColumn = await queryRunner.hasColumn('pickup_requests', 'request_code');
    
    if (!hasColumn) {
      console.log('Adding request_code column to pickup_requests table...');
      
      // Add the column
      await queryRunner.query(`
        ALTER TABLE "pickup_requests" 
        ADD COLUMN "request_code" varchar(20) UNIQUE
      `);
      
      // Generate request codes for existing records
      console.log('Generating request codes for existing pickup requests...');
      
      // Get all existing pickup requests ordered by created_at
      const existingRequests = await queryRunner.query(`
        SELECT id FROM "pickup_requests" 
        ORDER BY created_at ASC
      `);
      
      // Update each with a unique code starting from REQ-2001
      let counter = 2001;
      for (const request of existingRequests) {
        const code = `REQ-${counter}`;
        await queryRunner.query(`
          UPDATE "pickup_requests" 
          SET request_code = $1 
          WHERE id = $2
        `, [code, request.id]);
        counter++;
      }
      
      console.log(`✅ Generated ${existingRequests.length} request codes`);
      console.log('✅ request_code column added successfully');
    } else {
      console.log('⚠️ request_code column already exists, skipping');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('pickup_requests', 'request_code');
    
    if (hasColumn) {
      console.log('Removing request_code column from pickup_requests table...');
      await queryRunner.query(`
        ALTER TABLE "pickup_requests" 
        DROP COLUMN "request_code"
      `);
      console.log('✅ request_code column removed successfully');
    }
  }
}

