/**
 * Quick fix script to create the typeorm_metadata table
 * Run this before starting the app if you get the error:
 * "relation 'typeorm_metadata' does not exist"
 * 
 * Usage: node scripts/fix-typeorm-metadata.js
 */

require('dotenv').config();
const { Client } = require('pg');

async function fixTypeOrmMetadata() {
  console.log('🔧 Creating typeorm_metadata table...\n');

  // Get database connection from environment
  const databaseUrl = process.env.DATABASE_URL;
  
  let client;
  
  if (databaseUrl) {
    console.log('Using DATABASE_URL for connection');
    client = new Client({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('railway') ? { rejectUnauthorized: false } : false,
    });
  } else {
    console.log('Using individual connection parameters');
    client = new Client({
      host: process.env.PG_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT || '5432', 10),
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DB || 'courier_db',
    });
  }

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Create typeorm_metadata table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "typeorm_metadata" (
        "type" varchar(255) NOT NULL,
        "database" varchar(255) DEFAULT NULL,
        "schema" varchar(255) DEFAULT NULL,
        "table" varchar(255) DEFAULT NULL,
        "name" varchar(255) DEFAULT NULL,
        "value" text
      );
    `);
    console.log('✅ Created typeorm_metadata table\n');

    // Insert metadata for amount_difference generated column if it exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'delivery_verifications'
      );
    `);

    if (tableExists.rows[0].exists) {
      // Check if the column exists and is a generated column
      const columnInfo = await client.query(`
        SELECT column_name, is_generated
        FROM information_schema.columns 
        WHERE table_name = 'delivery_verifications' 
        AND column_name = 'amount_difference';
      `);

      if (columnInfo.rows.length > 0) {
        await client.query(`
          INSERT INTO "typeorm_metadata" ("type", "database", "schema", "table", "name", "value")
          SELECT 'GENERATED_COLUMN', current_database(), 'public', 'delivery_verifications', 'amount_difference', 'collected_amount - expected_cod_amount'
          WHERE NOT EXISTS (
            SELECT 1 FROM "typeorm_metadata" 
            WHERE "type" = 'GENERATED_COLUMN' 
            AND "table" = 'delivery_verifications' 
            AND "name" = 'amount_difference'
          );
        `);
        console.log('✅ Added metadata for amount_difference generated column\n');
      }
    }

    console.log('🎉 Fix complete! You can now start the application.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixTypeOrmMetadata();

