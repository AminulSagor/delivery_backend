/**
 * Start script for Railway deployment
 * Handles database connection retries and migrations before starting the app
 */

const { execSync, spawn } = require('child_process');
const { Client } = require('pg');

const MAX_DB_RETRIES = 15;
const DB_RETRY_DELAY = 5000; // 5 seconds
const MAX_MIGRATION_RETRIES = 3;

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

  for (let attempt = 1; attempt <= MAX_DB_RETRIES; attempt++) {
    const client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });

    try {
      console.log(`[STARTUP] Database connection attempt ${attempt}/${MAX_DB_RETRIES}...`);
      await client.connect();
      const result = await client.query('SELECT NOW()');
      console.log(`[STARTUP] ✅ Database connected! Server time: ${result.rows[0].now}`);
      await client.end();
      return true;
    } catch (error) {
      console.log(`[STARTUP] ❌ Connection failed: ${error.code || error.message}`);
      
      try {
        await client.end();
      } catch (e) {
        // Ignore cleanup errors
      }

      if (attempt < MAX_DB_RETRIES) {
        console.log(`[STARTUP] Waiting ${DB_RETRY_DELAY / 1000}s before next attempt...`);
        await sleep(DB_RETRY_DELAY);
      }
    }
  }

  console.error('[STARTUP] ❌ Could not connect to database after all retries');
  return false;
}

async function runMigrations() {
  console.log('[STARTUP] Running database migrations...');
  
  for (let attempt = 1; attempt <= MAX_MIGRATION_RETRIES; attempt++) {
    try {
      console.log(`[STARTUP] Migration attempt ${attempt}/${MAX_MIGRATION_RETRIES}...`);
      
      execSync('node ./node_modules/typeorm/cli.js -d dist/data-source.js migration:run', {
        stdio: 'inherit',
        timeout: 120000, // 2 minute timeout
      });
      
      console.log('[STARTUP] ✅ Migrations completed successfully!');
      return true;
    } catch (error) {
      console.log(`[STARTUP] ❌ Migration failed: ${error.message}`);
      
      if (attempt < MAX_MIGRATION_RETRIES) {
        console.log(`[STARTUP] Waiting 10s before retry...`);
        await sleep(10000);
      }
    }
  }
  
  console.error('[STARTUP] ❌ Migrations failed after all retries');
  console.log('[STARTUP] ⚠️ Starting app anyway - migrations may need manual intervention');
  return false;
}

function startApp() {
  console.log('[STARTUP] Starting NestJS application...');
  
  const app = spawn('node', ['dist/main'], {
    stdio: 'inherit',
    env: process.env,
  });

  app.on('error', (error) => {
    console.error('[STARTUP] Failed to start app:', error);
    process.exit(1);
  });

  app.on('exit', (code) => {
    console.log(`[STARTUP] App exited with code ${code}`);
    process.exit(code || 0);
  });
}

async function main() {
  console.log('[STARTUP] ========================================');
  console.log('[STARTUP] Railway Deployment Startup Script');
  console.log('[STARTUP] ========================================');
  
  // Step 1: Wait for database
  const dbReady = await waitForDatabase();
  
  if (!dbReady) {
    console.log('[STARTUP] ⚠️ Starting app without confirmed database connection');
  }
  
  // Step 2: Run migrations (only if DB is ready)
  if (dbReady) {
    await runMigrations();
  }
  
  // Step 3: Start the app
  startApp();
}

main().catch(err => {
  console.error('[STARTUP] Fatal error:', err);
  process.exit(1);
});

