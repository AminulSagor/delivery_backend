/**
 * Cleanup script to run before enabling synchronize
 * Removes leftover _old enum types that can cause sync failures
 */

require('dotenv').config();
const { Client } = require('pg');

async function cleanup() {
  console.log('🧹 Cleaning up before sync...\n');

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

    // Find and drop all _old enum types
    const oldEnums = await client.query(`
      SELECT typname FROM pg_type 
      WHERE typname LIKE '%_old' AND typtype = 'e'
    `);

    console.log(`Found ${oldEnums.rows.length} old enum types\n`);

    for (const row of oldEnums.rows) {
      console.log(`Dropping: ${row.typname}`);
      try {
        await client.query(`DROP TYPE IF EXISTS "${row.typname}" CASCADE`);
        console.log(`  ✅ Dropped`);
      } catch (e) {
        console.log(`  ⚠️ Warning: ${e.message}`);
      }
    }

    console.log('\n🎉 Cleanup complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

cleanup();

