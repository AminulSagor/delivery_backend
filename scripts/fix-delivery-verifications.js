/**
 * Fix script for delivery_verifications table
 * Ensures the amount_difference generated column is properly configured
 * 
 * Usage: node scripts/fix-delivery-verifications.js
 */

require('dotenv').config();
const { Client } = require('pg');

async function fixDeliveryVerifications() {
  console.log('🔧 Fixing delivery_verifications table...\n');

  const client = new Client({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DB || 'courier_db',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'delivery_verifications'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('ℹ️  Table delivery_verifications does not exist yet. Nothing to fix.');
      return;
    }

    // Check the column info
    const columnInfo = await client.query(`
      SELECT column_name, data_type, is_nullable, is_generated, generation_expression
      FROM information_schema.columns 
      WHERE table_name = 'delivery_verifications' 
      AND column_name = 'amount_difference';
    `);

    if (columnInfo.rows.length === 0) {
      console.log('Column amount_difference does not exist. Creating it as a generated column...');
      await client.query(`
        ALTER TABLE delivery_verifications 
        ADD COLUMN IF NOT EXISTS amount_difference DECIMAL(10,2) 
        GENERATED ALWAYS AS (collected_amount - expected_cod_amount) STORED;
      `);
      console.log('✅ Created amount_difference as generated column\n');
    } else {
      const col = columnInfo.rows[0];
      console.log('Column info:', col);
      
      if (col.is_generated === 'ALWAYS') {
        console.log('✅ amount_difference is already a generated column\n');
      } else {
        console.log('Converting amount_difference to a generated column...');
        
        // First, drop the existing column
        await client.query(`ALTER TABLE delivery_verifications DROP COLUMN amount_difference;`);
        
        // Then add it as a generated column
        await client.query(`
          ALTER TABLE delivery_verifications 
          ADD COLUMN amount_difference DECIMAL(10,2) 
          GENERATED ALWAYS AS (collected_amount - expected_cod_amount) STORED;
        `);
        console.log('✅ Converted amount_difference to generated column\n');
      }
    }

    // Update typeorm_metadata if needed
    const metadataExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM typeorm_metadata 
        WHERE type = 'GENERATED_COLUMN' 
        AND "table" = 'delivery_verifications' 
        AND name = 'amount_difference'
      );
    `);

    if (!metadataExists.rows[0].exists) {
      await client.query(`
        INSERT INTO typeorm_metadata (type, database, schema, "table", name, value)
        VALUES ('GENERATED_COLUMN', current_database(), 'public', 'delivery_verifications', 'amount_difference', 'collected_amount - expected_cod_amount');
      `);
      console.log('✅ Updated typeorm_metadata\n');
    }

    console.log('🎉 Fix complete! You can now start the application.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixDeliveryVerifications();

