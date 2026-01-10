/**
 * Railway Database Diagnostic Tool
 * 
 * This script helps diagnose database connection issues on Railway
 * Run with: node scripts/railway-db-diagnostic.js
 */

const { Client } = require('pg');

console.log('');
console.log('========================================');
console.log('Railway Database Diagnostic Tool');
console.log('========================================');
console.log('');

// Check environment variables
console.log('📋 Environment Variables Check:');
console.log('--------------------------------');
const databaseUrl = process.env.DATABASE_URL;
const pgHost = process.env.PGHOST;
const pgPort = process.env.PGPORT;
const pgUser = process.env.PGUSER;
const pgPassword = process.env.PGPASSWORD;
const pgDatabase = process.env.PGDATABASE;
const railwayPrivateDomain = process.env.RAILWAY_PRIVATE_DOMAIN;

console.log('DATABASE_URL:', databaseUrl ? '✅ SET' : '❌ NOT SET');
console.log('PGHOST:', pgHost || 'NOT SET');
console.log('PGPORT:', pgPort || 'NOT SET');
console.log('PGUSER:', pgUser || 'NOT SET');
console.log('PGPASSWORD:', pgPassword ? '✅ SET (hidden)' : '❌ NOT SET');
console.log('PGDATABASE:', pgDatabase || 'NOT SET');
console.log('RAILWAY_PRIVATE_DOMAIN:', railwayPrivateDomain || 'NOT SET');
console.log('');

// Check if DATABASE_URL contains template syntax (unresolved)
if (databaseUrl && databaseUrl.includes('${{')) {
  console.log('❌ CRITICAL ERROR: DATABASE_URL contains unresolved Railway template syntax!');
  console.log('   This means the database is NOT properly linked to your web service.');
  console.log('');
  console.log('🔧 FIX:');
  console.log('   1. Go to your web service in Railway dashboard');
  console.log('   2. Click "Variables" tab');
  console.log('   3. Delete the DATABASE_URL variable');
  console.log('   4. Click "New Variable" → "Add a Reference"');
  console.log('   5. Select your PostgreSQL service → DATABASE_URL');
  console.log('   6. Redeploy your service');
  console.log('');
  process.exit(1);
}

if (!databaseUrl) {
  console.log('❌ CRITICAL ERROR: DATABASE_URL is not set!');
  console.log('');
  console.log('🔧 FIX:');
  console.log('   1. Go to your web service in Railway dashboard');
  console.log('   2. Click "Variables" tab');
  console.log('   3. Click "New Variable" → "Add a Reference"');
  console.log('   4. Select your PostgreSQL service → DATABASE_URL');
  console.log('   5. Redeploy your service');
  console.log('');
  process.exit(1);
}

// Parse DATABASE_URL
console.log('🔍 Parsing DATABASE_URL:');
console.log('--------------------------------');
try {
  const url = new URL(databaseUrl);
  console.log('Protocol:', url.protocol);
  console.log('Hostname:', url.hostname);
  console.log('Port:', url.port || '5432');
  console.log('Database:', url.pathname.substring(1));
  console.log('Username:', url.username);
  console.log('Password:', url.password ? '✅ SET (hidden)' : '❌ NOT SET');
  console.log('');
  
  // Check for Railway internal domain
  if (url.hostname.includes('railway.internal')) {
    console.log('✅ Using Railway private network (recommended)');
  } else if (url.hostname.includes('railway.app')) {
    console.log('⚠️  Using Railway public network (works but less secure)');
  } else {
    console.log('ℹ️  Using custom hostname:', url.hostname);
  }
  console.log('');
} catch (error) {
  console.log('❌ ERROR: Invalid DATABASE_URL format!');
  console.log('Error:', error.message);
  console.log('');
  process.exit(1);
}

// Test connection
console.log('🔌 Testing Database Connection:');
console.log('--------------------------------');

async function testConnection() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('Attempting to connect...');
    await client.connect();
    console.log('✅ Connected successfully!');
    console.log('');

    // Test query
    console.log('Running test query...');
    const result = await client.query('SELECT NOW(), version() as db_version');
    console.log('✅ Query executed successfully!');
    console.log('Server time:', result.rows[0].now);
    console.log('PostgreSQL version:', result.rows[0].db_version.split(' ').slice(0, 2).join(' '));
    console.log('');

    // Check for tables
    console.log('Checking for tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log(`✅ Found ${tablesResult.rows.length} tables:`);
      tablesResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.table_name}`);
      });
    } else {
      console.log('ℹ️  No tables found (database might be new or migrations haven\'t run)');
    }
    console.log('');

    await client.end();

    console.log('========================================');
    console.log('✅ ALL CHECKS PASSED!');
    console.log('Your database connection is working correctly.');
    console.log('========================================');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.log('❌ Connection failed!');
    console.log('');
    console.log('Error details:');
    console.log('  Code:', error.code || 'UNKNOWN');
    console.log('  Message:', error.message);
    console.log('');

    // Provide specific guidance based on error code
    if (error.code === 'ECONNRESET') {
      console.log('🔧 ECONNRESET usually means:');
      console.log('   1. Database service is not running or restarting');
      console.log('   2. Network/firewall issue between services');
      console.log('   3. Database is overloaded or out of resources');
      console.log('');
      console.log('Try:');
      console.log('   - Check database service status in Railway dashboard');
      console.log('   - Redeploy the database service');
      console.log('   - Check Railway status page: https://status.railway.app/');
    } else if (error.code === 'ENOTFOUND') {
      console.log('🔧 ENOTFOUND means the hostname cannot be resolved:');
      console.log('   1. Verify services are in the same Railway project');
      console.log('   2. Ensure private networking is enabled');
      console.log('   3. Check DATABASE_URL format');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('🔧 ETIMEDOUT means connection timed out:');
      console.log('   1. Database might be starting up (wait and retry)');
      console.log('   2. Network connectivity issue');
      console.log('   3. Firewall blocking the connection');
    } else if (error.code === '28P01') {
      console.log('🔧 Authentication failed:');
      console.log('   - The password in DATABASE_URL is incorrect');
      console.log('   - Verify DATABASE_URL is correctly referenced from PostgreSQL service');
    }
    
    console.log('');
    console.log('========================================');
    console.log('❌ DIAGNOSTIC FAILED');
    console.log('Please check the errors above and try again.');
    console.log('========================================');
    console.log('');

    try {
      await client.end();
    } catch (e) {
      // Ignore cleanup errors
    }

    process.exit(1);
  }
}

testConnection();

