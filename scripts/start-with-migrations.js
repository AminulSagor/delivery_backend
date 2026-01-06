/**
 * Simplified Railway startup - let TypeORM handle DB connections
 * No pre-connection checks, just start the app
 */

const { spawn } = require('child_process');

function startApp() {
  console.log('');
  console.log('========================================');
  console.log('Railway Deployment - Starting App');
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
  console.log('TypeORM will handle DB connections automatically');
  console.log('Migrations will run on first successful connection');
  console.log('');
  console.log('Starting NestJS application...');
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

// Just start the app immediately
startApp();
