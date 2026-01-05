/**
 * Start script for Railway deployment
 * Waits for database to be ready, then starts the NestJS app
 * Migrations run automatically via TypeORM's migrationsRun option
 */

const { spawn } = require('child_process');
const { Client } = require('pg');

const MAX_DB_RETRIES = 30;
const DB_RETRY_DELAY = 5000; // 5 seconds
const INITIAL_DELAY = 10000; // 10 seconds - wait before first attempt

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log('[STARTUP] No DATABASE_URL found, starting app directly...');
    return true;
  }

  console.log('[STARTUP] Waiting for database connection...');
  console.log(`[STARTUP] Waiting ${INITIAL_DELAY / 1000}s before first attempt...`);
  await sleep(INITIAL_DELAY);
  
  console.log(`[STARTUP] Will retry up to ${MAX_DB_RETRIES} times...`);

  for (let attempt = 1; attempt <= MAX_DB_RETRIES; attempt++) {
    const client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000,
      query_timeout: 10000,
    });

    try {
      console.log(`[STARTUP] Attempt ${attempt}/${MAX_DB_RETRIES}...`);
      await client.connect();
      const result = await client.query('SELECT 1 as test');
      console.log(`[STARTUP] ✅ Database is ready!`);
      await client.end();
      return true;
    } catch (error) {
      const errMsg = error.code || error.message || 'Unknown error';
      console.log(`[STARTUP] ❌ Failed: ${errMsg}`);
      
      try { await client.end(); } catch (e) {}

      if (attempt < MAX_DB_RETRIES) {
        console.log(`[STARTUP] Retrying in ${DB_RETRY_DELAY / 1000}s...`);
        await sleep(DB_RETRY_DELAY);
      }
    }
  }

  console.error('[STARTUP] ❌ Database not available after all retries');
  console.log('[STARTUP] ⚠️ Starting app anyway...');
  return false;
}

function startApp() {
  console.log('[STARTUP] ========================================');
  console.log('[STARTUP] Starting NestJS application...');
  console.log('[STARTUP] Migrations will run automatically on startup');
  console.log('[STARTUP] ========================================');
  
  const app = spawn('node', ['dist/src/main'], {
    stdio: 'inherit',
    env: process.env,
  });

  app.on('error', (error) => {
    console.error('[STARTUP] Failed to start app:', error);
    process.exit(1);
  });

  app.on('exit', (code) => {
    process.exit(code || 0);
  });
}

async function main() {
  console.log('');
  console.log('[STARTUP] ========================================');
  console.log('[STARTUP] Railway Startup Script v2');
  console.log('[STARTUP] ========================================');
  console.log('');
  
  await waitForDatabase();
  startApp();
}

main().catch(err => {
  console.error('[STARTUP] Fatal error:', err);
  process.exit(1);
});
