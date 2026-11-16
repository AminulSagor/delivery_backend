/**
 * Railway startup script with CSV import
 * 1. Validates DATABASE_URL
 * 2. Runs all pending TypeORM migrations
 * 3. Imports coverage areas from CSV
 * 4. Starts the NestJS application
 */

const { spawn } = require('child_process');
const { importCoverageAreas } = require('./import-coverage-production');

async function startDeployment() {
  console.log('');
  console.log('========================================');
  console.log('Railway Deployment - Starting');
  console.log('========================================');
  console.log('');
  
  const databaseUrl = process.env.DATABASE_URL;
  // Check for unresolved template syntax
  if (databaseUrl && databaseUrl.includes('${{')) {
    console.error('❌ CRITICAL ERROR: DATABASE_URL contains unresolved Railway template syntax!');
    console.error('');
    console.error('🔧 FIX in Railway Dashboard:');
    console.error('   1. Go to your web service → Variables tab');
    console.error('   2. Delete the DATABASE_URL variable');
    console.error('   3. Click "New Variable" → "Add a Reference"');
    console.error('   4. Select PostgreSQL service → DATABASE_URL');
    console.error('   5. Redeploy');
    console.error('');
    console.error('📖 See RAILWAY_DATABASE_CONNECTION_FIX.md for detailed instructions');
    console.error('');
    process.exit(1);
  }
  
  console.log('DATABASE_URL:', databaseUrl ? 'SET ✅' : 'NOT SET ❌');
  console.log('PORT:', process.env.PORT || '3000');
  console.log('NODE_ENV:', process.env.NODE_ENV || 'production');
  
  // Show connection target
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      console.log('Database Host:', url.hostname);
      console.log('Database Port:', url.port || '5432');
      console.log('Database Name:', url.pathname.substring(1));
    } catch (e) {
      console.error('Warning: Could not parse DATABASE_URL');
    }
  }
  
  console.log('');
  
  console.log('Database schema mode: migrations only');
  console.log('');

  console.log('========================================');
  console.log('Step 1: Run Database Migrations');
  console.log('========================================');

  const dataSourceModule = require('../dist/src/data-source');
  const dataSource = dataSourceModule.default;

  try {
    await dataSource.initialize();
    const appliedMigrations = await dataSource.runMigrations({
      transaction: 'all',
    });
    console.log(`Applied migrations: ${appliedMigrations.length}`);
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }

  // Import coverage areas from CSV before starting the app
  console.log('========================================');
  console.log('Step 2: Import Coverage Areas');
  console.log('========================================');
  
  try {
    await importCoverageAreas();
  } catch (error) {
    console.error('⚠️  Coverage areas import failed:', error.message);
    console.log('⏭️  Continuing with app startup...');
    console.log('');
  }

  // Start the application
  console.log('========================================');
  console.log('Step 3: Starting NestJS Application');
  console.log('========================================');
  console.log('');
  
  const app = spawn('node', ['dist/src/main'], {
    stdio: 'inherit',
    env: process.env,
  });

  app.on('error', (error) => {
    console.error('[ERROR] Failed to start application:', error);
    process.exit(1);
  });

  app.on('exit', (code) => {
    console.log(`[EXIT] Application exited with code ${code}`);
    process.exit(code || 0);
  });
}

// Start the deployment process
startDeployment().catch((error) => {
  console.error('💥 Deployment failed:', error);
  process.exit(1);
});
