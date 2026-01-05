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
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET ✅' : 'NOT SET ❌');
  console.log('PORT:', process.env.PORT || '3000');
  console.log('NODE_ENV:', process.env.NODE_ENV || 'production');
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
