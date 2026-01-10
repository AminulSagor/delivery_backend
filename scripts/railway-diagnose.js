/**
 * Railway Database Diagnostic Tool
 * Run this to check your DATABASE_URL and connection
 */

const { Client } = require('pg');

async function diagnose() {
  console.log('========================================');
  console.log('Railway Database Diagnostic Tool');
  console.log('========================================\n');

  // Check environment
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set!');
    console.log('\nPlease ensure your Railway database service is linked.');
    process.exit(1);
  }

  console.log('✅ DATABASE_URL is set');
  
  // Parse URL (hide password)
  try {
    const url = new URL(databaseUrl);
    console.log('\nConnection Details:');
    console.log(`  Host: ${url.hostname}`);
    console.log(`  Port: ${url.port || '5432'}`);
    console.log(`  Database: ${url.pathname.slice(1)}`);
    console.log(`  Username: ${url.username}`);
    console.log(`  Password: ${'*'.repeat(10)}`);
    console.log(`  SSL: ${url.searchParams.get('sslmode') || 'not specified'}`);
  } catch (err) {
    console.error('⚠️  Could not parse DATABASE_URL:', err.message);
  }

  // Try different connection configurations
  const configs = [
    {
      name: 'Standard SSL',
      config: {
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 20000,
      },
    },
    {
      name: 'No SSL',
      config: {
        connectionString: databaseUrl.replace('?sslmode=require', ''),
        ssl: false,
        connectionTimeoutMillis: 20000,
      },
    },
    {
      name: 'Require SSL',
      config: {
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false, require: true },
        connectionTimeoutMillis: 20000,
      },
    },
  ];

  for (const { name, config } of configs) {
    console.log(`\n--- Testing: ${name} ---`);
    const client = new Client(config);

    try {
      console.log('Connecting...');
      await client.connect();
      
      console.log('✅ Connected!');
      
      const result = await client.query('SELECT version()');
      console.log('✅ Query successful!');
      console.log(`Database: ${result.rows[0].version.split(',')[0]}`);
      
      await client.end();
      console.log('✅ Connection closed cleanly');
      
      console.log('\n🎉 SUCCESS! This configuration works.');
      return;
    } catch (error) {
      console.error(`❌ Failed: ${error.code || error.message}`);
      try {
        await client.end();
      } catch (e) {}
    }
  }

  console.log('\n❌ All connection attempts failed!');
  console.log('\nTroubleshooting steps:');
  console.log('1. Ensure database service is running');
  console.log('2. Check if database and app are in the same Railway project');
  console.log('3. Verify DATABASE_URL is correctly set');
  console.log('4. Check Railway dashboard for database status');
  process.exit(1);
}

diagnose().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

