import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPickedUpCountToPickupRequests1768500000000
  implements MigrationInterface
{
  name = 'AddPickedUpCountToPickupRequests1768500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column already exists
    const hasColumn = await queryRunner.hasColumn(
      'pickup_requests',
      'picked_up_count',
    );

    if (!hasColumn) {
      console.log('Adding picked_up_count column to pickup_requests table...');
      await queryRunner.query(`
        ALTER TABLE "pickup_requests" 
        ADD COLUMN "picked_up_count" integer NOT NULL DEFAULT 0
      `);
      console.log('✅ picked_up_count column added successfully');
    } else {
      console.log('⚠️ picked_up_count column already exists, skipping');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(
      'pickup_requests',
      'picked_up_count',
    );

    if (hasColumn) {
      console.log(
        'Removing picked_up_count column from pickup_requests table...',
      );
      await queryRunner.query(`
        ALTER TABLE "pickup_requests" 
        DROP COLUMN "picked_up_count"
      `);
      console.log('✅ picked_up_count column removed successfully');
    }
  }
}
