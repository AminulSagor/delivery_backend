import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Cleanup weight charge columns
 * 
 * Removes unnecessary columns and tables:
 * - Drop weight_charge_configurations table (if exists)
 * - Drop free_weight_kg and charge_per_step from pricing_configurations (fixed values, not stored)
 * - Keep only weight_step_kg as configurable
 */
export class CleanupWeightChargeColumns1768080000000 implements MigrationInterface {
  name = 'CleanupWeightChargeColumns1768080000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the weight_charge_configurations table if it exists
    await queryRunner.query(`DROP TABLE IF EXISTS "weight_charge_configurations" CASCADE`);
    
    // Drop free_weight_kg column if exists (fixed at 0.5 kg, not stored)
    await queryRunner.query(`
      ALTER TABLE "pricing_configurations" 
      DROP COLUMN IF EXISTS "free_weight_kg"
    `);
    
    // Drop charge_per_step column if exists (fixed per zone, not stored)
    await queryRunner.query(`
      ALTER TABLE "pricing_configurations" 
      DROP COLUMN IF EXISTS "charge_per_step"
    `);

    console.log('✅ Cleaned up weight charge columns');
    console.log('');
    console.log('📋 Fixed Values (not stored in DB):');
    console.log('   - free_weight_kg = 0.5 kg (always)');
    console.log('   - charge_per_step = 10 BDT (INSIDE_DHAKA), 20 BDT (others)');
    console.log('');
    console.log('📋 Configurable (stored in DB):');
    console.log('   - weight_step_kg (default: 0.5/2.0/1.0 per zone)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add columns if needed
    await queryRunner.query(`
      ALTER TABLE "pricing_configurations" 
      ADD COLUMN IF NOT EXISTS "free_weight_kg" decimal(5,2) NOT NULL DEFAULT 0.5
    `);
    
    await queryRunner.query(`
      ALTER TABLE "pricing_configurations" 
      ADD COLUMN IF NOT EXISTS "charge_per_step" decimal(10,2) NOT NULL DEFAULT 10
    `);

    console.log('⬇️ Reverted: Added back free_weight_kg and charge_per_step columns');
  }
}

