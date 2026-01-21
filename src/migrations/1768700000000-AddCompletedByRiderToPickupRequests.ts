import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompletedByRiderToPickupRequests1768700000000 implements MigrationInterface {
  name = 'AddCompletedByRiderToPickupRequests1768700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column already exists
    const hasColumn = await queryRunner.hasColumn('pickup_requests', 'completed_by_rider_id');
    
    if (!hasColumn) {
      console.log('Adding completed_by_rider_id column to pickup_requests table...');
      
      await queryRunner.query(`
        ALTER TABLE "pickup_requests" 
        ADD COLUMN "completed_by_rider_id" uuid
      `);
      
      // Add foreign key constraint
      await queryRunner.query(`
        ALTER TABLE "pickup_requests"
        ADD CONSTRAINT "FK_pickup_requests_completed_by_rider"
        FOREIGN KEY ("completed_by_rider_id")
        REFERENCES "riders"("id")
        ON DELETE SET NULL
      `);
      
      console.log('✅ completed_by_rider_id column added successfully');
    } else {
      console.log('⚠️ completed_by_rider_id column already exists, skipping');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('pickup_requests', 'completed_by_rider_id');
    
    if (hasColumn) {
      console.log('Removing completed_by_rider_id column...');
      
      // Drop foreign key first
      await queryRunner.query(`
        ALTER TABLE "pickup_requests"
        DROP CONSTRAINT IF EXISTS "FK_pickup_requests_completed_by_rider"
      `);
      
      await queryRunner.query(`
        ALTER TABLE "pickup_requests" 
        DROP COLUMN "completed_by_rider_id"
      `);
      
      console.log('✅ completed_by_rider_id column removed successfully');
    }
  }
}

