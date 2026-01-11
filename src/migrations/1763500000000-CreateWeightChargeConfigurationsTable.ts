import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add weight_step_kg to pricing_configurations table
 * 
 * This adds zone-based weight step size for calculating charges.
 * 
 * FIXED VALUES (not stored in DB, handled by code):
 * - free_weight_kg: 0.5 kg (first 0.5 kg is always free)
 * - charge_per_step: 10 BDT for INSIDE_DHAKA, 20 BDT for SUB_DHAKA & OUTSIDE_DHAKA
 * 
 * CONFIGURABLE (stored in DB):
 * - weight_step_kg: Weight step size per zone
 * 
 * DEFAULT WEIGHT STEPS BY ZONE:
 * - INSIDE_DHAKA: 0.5 kg per step
 * - SUB_DHAKA: 2.0 kg per step
 * - OUTSIDE_DHAKA: 1.0 kg per step
 */
export class CreateWeightChargeConfigurationsTable1763500000000 implements MigrationInterface {
  name = 'CreateWeightChargeConfigurationsTable1763500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if weight_step_kg column already exists
    const hasNewColumn = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'pricing_configurations' AND column_name = 'weight_step_kg'
    `);

    if (hasNewColumn.length > 0) {
      console.log('✅ weight_step_kg column already exists in pricing_configurations');
      
      // Clean up old columns if they exist
      await queryRunner.query(`
        ALTER TABLE "pricing_configurations" 
        DROP COLUMN IF EXISTS "free_weight_kg"
      `);
      await queryRunner.query(`
        ALTER TABLE "pricing_configurations" 
        DROP COLUMN IF EXISTS "charge_per_step"
      `);
      await queryRunner.query(`
        ALTER TABLE "pricing_configurations" 
        DROP COLUMN IF EXISTS "weight_charge_per_kg"
      `);
      return;
    }

    // Add weight_step_kg column
    await queryRunner.query(`
      ALTER TABLE "pricing_configurations" 
      ADD COLUMN IF NOT EXISTS "weight_step_kg" decimal(5,2) NOT NULL DEFAULT 0.5
    `);

    // Check if old weight_charge_per_kg column exists and migrate
    const hasOldColumn = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'pricing_configurations' AND column_name = 'weight_charge_per_kg'
    `);

    if (hasOldColumn.length > 0) {
      // Update weight_step_kg based on zone defaults
      await queryRunner.query(`
        UPDATE "pricing_configurations" 
        SET "weight_step_kg" = CASE 
          WHEN "zone" = 'INSIDE_DHAKA' THEN 0.5
          WHEN "zone" = 'SUB_DHAKA' THEN 2.0
          WHEN "zone" = 'OUTSIDE_DHAKA' THEN 1.0
          ELSE 0.5
        END
      `);

      // Drop old column (no longer needed - charge is fixed per zone)
      await queryRunner.query(`
        ALTER TABLE "pricing_configurations" 
        DROP COLUMN IF EXISTS "weight_charge_per_kg"
      `);
    }

    // Clean up any other columns that might exist from previous migrations
    await queryRunner.query(`
      ALTER TABLE "pricing_configurations" 
      DROP COLUMN IF EXISTS "free_weight_kg"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_configurations" 
      DROP COLUMN IF EXISTS "charge_per_step"
    `);

    console.log('✅ Added weight_step_kg to pricing_configurations');
    console.log('');
    console.log('📋 Weight Charge Rules:');
    console.log('   - First 0.5 kg is FREE (fixed)');
    console.log('   - INSIDE_DHAKA: 10 BDT per step (fixed)');
    console.log('   - SUB_DHAKA: 20 BDT per step (fixed)');
    console.log('   - OUTSIDE_DHAKA: 20 BDT per step (fixed)');
    console.log('');
    console.log('📋 Default weight steps:');
    console.log('   - INSIDE_DHAKA: 0.5 kg per step');
    console.log('   - SUB_DHAKA: 2.0 kg per step');
    console.log('   - OUTSIDE_DHAKA: 1.0 kg per step');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if old column exists
    const hasOldColumn = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'pricing_configurations' AND column_name = 'weight_charge_per_kg'
    `);

    if (hasOldColumn.length === 0) {
      // Re-create old column with default value based on zone
      await queryRunner.query(`
        ALTER TABLE "pricing_configurations" 
        ADD COLUMN "weight_charge_per_kg" decimal(10,2) NOT NULL DEFAULT 10
      `);

      // Set values based on zone
      await queryRunner.query(`
        UPDATE "pricing_configurations" 
        SET "weight_charge_per_kg" = CASE 
          WHEN "zone" = 'INSIDE_DHAKA' THEN 10
          ELSE 20
        END
      `);
    }

    // Drop weight_step_kg column
    await queryRunner.query(`
      ALTER TABLE "pricing_configurations" 
      DROP COLUMN IF EXISTS "weight_step_kg"
    `);

    console.log('⬇️ Reverted weight_step_kg column in pricing_configurations');
  }
}

