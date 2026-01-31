#!/usr/bin/env node

/**
 * Railway Database Connection Tester
 * Run this to verify your Railway PostgreSQL connection before starting the app
 */

require('dotenv').config();
const { Client } = require('pg');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testConnection() {
  console.log('\n' + '='.repeat(60));
  log('🧪 Railway PostgreSQL Connection Test', colors.bright);
  console.log('='.repeat(60) + '\n');

  // Check for DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    log('❌ ERROR: DATABASE_URL is not set in .env file', colors.red);
    log('\n📋 Steps to fix:', colors.yellow);
    log('1. Open .env file');
    log('2. Get your Railway TCP Proxy Port from Railway Dashboard');
    log('3. Update DATABASE_URL with the actual port number');
    log('\nExample:', colors.blue);
    log('DATABASE_URL=postgresql://postgres:password@autorack.proxy.rlwy.net:12345/railway');
    process.exit(1);
  }

  // Check for placeholder
  if (databaseUrl.includes('YOUR_TCP_PROXY_PORT')) {
    log('⚠️  WARNING: DATABASE_URL contains placeholder "YOUR_TCP_PROXY_PORT"', colors.yellow);
    log('\n📋 Steps to fix:', colors.yellow);
    log('1. Go to Railway Dashboard → Your PostgreSQL Service → Connect tab');
    log('2. Find the TCP Proxy section');
    log('3. Copy the port number (e.g., 12345)');
    log('4. Replace YOUR_TCP_PROXY_PORT in .env file with actual port');
    process.exit(1);
  }

  log('📍 Connection Details:', colors.blue);
  try {
    const url = new URL(databaseUrl);
    console.log(`   Host: ${url.hostname}`);
    console.log(`   Port: ${url.port || '5432'}`);
    console.log(`   Database: ${url.pathname.substring(1)}`);
    console.log(`   User: ${url.username}`);
    console.log(`   SSL: Disabled (for Railway TCP Proxy)`);
  } catch (e) {
    log(`   ${databaseUrl.substring(0, 50)}...`, colors.yellow);
  }

  console.log('');
  log('🔌 Attempting to connect...', colors.blue);

  const client = new Client({
    connectionString: databaseUrl,
    ssl: false, // Disable SSL for Railway TCP Proxy
    connectionTimeoutMillis: 10000,
  });

  let connected = false;

  try {
    log('Connecting...', colors.blue);
    await client.connect();
    connected = true;
    log('✅ Connection successful!', colors.green);

    // Test simple query first
    log('\n📊 Testing basic query...', colors.blue);
    try {
      const result = await client.query('SELECT 1 as test');
      log('✅ Query successful!', colors.green);
    } catch (queryError) {
      log(`⚠️ Query test failed: ${queryError.message}`, colors.yellow);
    }
    
    // Now test more detailed query
    log('\n📊 Getting database info...', colors.blue);
    try {
      const dbInfo = await client.query('SELECT version() as version, current_database() as db, current_user as "user"');
      
      if (dbInfo.rows && dbInfo.rows.length > 0) {
        const versionParts = dbInfo.rows[0].version.split(' ');
        console.log(`   PostgreSQL Version: ${versionParts[0]} ${versionParts[1] || ''}`);
        console.log(`   Database: ${dbInfo.rows[0].db}`);
        console.log(`   User: ${dbInfo.rows[0].user}`);
      }
    } catch (infoError) {
      log(`⚠️ Could not get database info: ${infoError.message}`, colors.yellow);
    }

    // Check for tables
    log('\n📋 Checking existing tables...', colors.blue);
    try {
      const tables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);

      const tables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);

      if (tables.rows.length > 0) {
        log(`✅ Found ${tables.rows.length} existing tables:`, colors.green);
        tables.rows.slice(0, 10).forEach(row => {
          console.log(`   - ${row.table_name}`);
        });
        if (tables.rows.length > 10) {
          console.log(`   ... and ${tables.rows.length - 10} more`);
        }
      } else {
        log('ℹ️  No tables found (will be created on first app start)', colors.yellow);
      }
    } catch (tableError) {
      log(`⚠️  Could not list tables: ${tableError.message}`, colors.yellow);
    }

    console.log('\n' + '='.repeat(60));
    log('✅ Railway PostgreSQL is ready for local development!', colors.green);
    console.log('='.repeat(60) + '\n');
    
    log('🚀 Next steps:', colors.blue);
    log('1. Run: npm run start:dev');
    log('2. Tables will auto-create on startup (synchronize: true)');
    log('3. Start developing!\n');

  } catch (error) {
    if (!connected) {
      log('\n❌ Connection failed!', colors.red);
    } else {
      log('\n❌ Error during testing!', colors.red);
    }
    console.error('Error:', error.message);
    
    log('\n🔧 Troubleshooting:', colors.yellow);
    
    if (error.message.includes('ECONNREFUSED')) {
      log('• Check if the Railway TCP Proxy Port is correct');
      log('• Verify Railway service is running');
    } else if (error.message.includes('timeout')) {
      log('• Connection timeout - check your internet connection');
      log('• Verify Railway service is not paused');
      log('• Check if firewall is blocking the connection');
    } else if (error.message.includes('authentication failed')) {
      log('• Check if password is correct in .env');
      log('• Verify credentials in Railway Dashboard');
    } else {
      log('• Double-check all connection details in .env');
      log('• Verify Railway service is active');
      log('• Check Railway Dashboard for service status');
    }
    
    log('\n📖 See RAILWAY_LOCAL_DEVELOPMENT_SETUP.md for detailed instructions', colors.blue);
    process.exit(1);
  } finally {
    if (connected && client) {
      try {
        await client.end();
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

// Run the test
testConnection().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
