/**
 * Schema sync script - adds missing columns that entities expect
 * Run this after disabling synchronize to ensure all columns exist
 * 
 * Usage: node scripts/sync-schema.js
 */

require('dotenv').config();
const { Client } = require('pg');

// Define expected columns for tables that might have missing columns
const EXPECTED_COLUMNS = {
  users: [
    { name: 'reset_otp', type: 'VARCHAR(6)', default: 'NULL' },
    { name: 'reset_otp_expires', type: 'TIMESTAMP', default: 'NULL' },
    { name: 'refresh_token', type: 'TEXT', default: 'NULL' },
  ],
  delivery_verifications: [
    { name: 'rider_id', type: 'UUID', default: 'NULL' },
    { name: 'selected_status', type: 'VARCHAR(50)', default: 'NULL' },
    { name: 'otp_recipient_type', type: 'otp_recipient_type_enum', default: "'MERCHANT'" },
    { name: 'otp_sent_to_phone', type: 'VARCHAR(20)', default: 'NULL' },
    { name: 'customer_phone_used', type: 'VARCHAR(20)', default: 'NULL' },
    { name: 'otp_verified_by', type: 'otp_recipient_type_enum', default: 'NULL' },
  ],
};

async function syncSchema() {
  console.log('🔧 Syncing database schema...\n');

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

    for (const [tableName, columns] of Object.entries(EXPECTED_COLUMNS)) {
      console.log(`Checking table: ${tableName}`);
      
      // Check if table exists
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [tableName]);

      if (!tableExists.rows[0].exists) {
        console.log(`  ⚠️  Table ${tableName} does not exist, skipping\n`);
        continue;
      }

      // Get existing columns
      const existingCols = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public';
      `, [tableName]);

      const existingColNames = existingCols.rows.map(r => r.column_name);

      for (const col of columns) {
        if (!existingColNames.includes(col.name)) {
          console.log(`  Adding column: ${col.name}`);
          try {
            await client.query(`
              ALTER TABLE "${tableName}" 
              ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type} DEFAULT ${col.default};
            `);
            console.log(`  ✅ Added ${col.name}`);
          } catch (e) {
            console.log(`  ⚠️  Could not add ${col.name}: ${e.message}`);
          }
        } else {
          console.log(`  ✓ ${col.name} exists`);
        }
      }
      console.log('');
    }

    console.log('🎉 Schema sync complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

syncSchema();

