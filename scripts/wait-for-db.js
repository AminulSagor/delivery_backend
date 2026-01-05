/**
 * Wait for database to be ready before running migrations
 * This script handles Railway's cold-start database delays
 */

const { Client } = require('pg');

const MAX_RETRIES = 10;
const RETRY_DELAY = 5000; // 5 seconds

async function waitForDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log('[DB-WAIT] No DATABASE_URL found, skipping wait...');
    return;
  }

  console.log('[DB-WAIT] Waiting for database to be ready...');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });

    try {
      console.log(`[DB-WAIT] Attempt ${attempt}/${MAX_RETRIES}...`);
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log('[DB-WAIT] ✅ Database is ready!');
      return;
    } catch (error) {
      console.log(`[DB-WAIT] ❌ Connection failed: ${error.message}`);
      try {
        await client.end();
      } catch (e) {
        // Ignore cleanup errors
      }

      if (attempt < MAX_RETRIES) {
        console.log(`[DB-WAIT] Waiting ${RETRY_DELAY / 1000} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  console.error('[DB-WAIT] ❌ Failed to connect to database after all retries');
  process.exit(1);
}

waitForDatabase().catch(err => {
  console.error('[DB-WAIT] Fatal error:', err);
  process.exit(1);
});

