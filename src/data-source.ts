import { DataSource, DataSourceOptions, LoggerOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

// Detect if running via ts-node (development) or compiled js (production)
const isTs = __filename.endsWith('.ts');

// Check for DATABASE_URL first (Railway provides this)
const databaseUrl = process.env.DATABASE_URL;

// Check if DATABASE_URL contains unresolved Railway template syntax
if (databaseUrl && databaseUrl.includes('${{')) {
  console.error('');
  console.error('❌ CRITICAL ERROR: DATABASE_URL contains unresolved Railway template syntax!');
  console.error('   Current value contains: ${{...}}');
  console.error('');
  console.error('   This means the database is NOT properly linked to your web service.');
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
  throw new Error('DATABASE_URL contains unresolved Railway template syntax');
}

// Check if running on Railway or in production
const isProduction = !!(
  process.env.NODE_ENV === 'production' ||
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.RAILWAY_PRIVATE_DOMAIN ||
  databaseUrl
);

// FORCE_SYNC: Set to 'true' to enable TypeORM synchronize
// This will auto-create ALL missing tables based on entities
// USE ONLY for first deployment or when you need to sync schema
// After sync, REMOVE this env var to use migrations-only mode
const forceSync = process.env.FORCE_SYNC === 'true';

// Base configuration shared across environments
const baseConfig = {
  type: 'postgres' as const,
  entities: isTs
    ? [path.join(__dirname, '**/*.entity.ts')]
    : [path.join(__dirname, '**/*.entity.js')],
  migrations: isTs
    ? [path.join(__dirname, 'migrations/*.ts')]
    : [path.join(__dirname, 'migrations/*.js')],
  // synchronize: When true, TypeORM auto-creates/updates tables based on entities
  // FORCE_SYNC env var enables this for first deployment or schema fixes
  // Default: false (use migrations for schema changes)
  synchronize: forceSync,
  logging: (forceSync ? ['schema', 'error', 'warn'] : false) as LoggerOptions,
};

// Railway/Production config: Use DATABASE_URL directly if available
// Railway requires: SSL + small pool size + short timeouts
const productionConfig: DataSourceOptions = databaseUrl
  ? {
      ...baseConfig,
      url: databaseUrl,
      ssl: { rejectUnauthorized: false }, // Required for Railway proxy
      extra: {
        max: 5,                      // Small pool for Railway limits
        idleTimeoutMillis: 30000,    // 30s idle timeout
        connectionTimeoutMillis: 5000, // 5s connection timeout (Railway proxy)
      },
    }
  : {
      ...baseConfig,
      host: process.env.PGHOST || process.env.RAILWAY_PRIVATE_DOMAIN,
      port: parseInt(process.env.PGPORT || '5432', 10),
      username: process.env.PGUSER || process.env.POSTGRES_USER || 'postgres',
      password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD,
      database: process.env.PGDATABASE || process.env.POSTGRES_DB || 'railway',
      ssl: { rejectUnauthorized: false }, // Required for Railway proxy
      extra: {
        max: 5,                      // Small pool for Railway limits
        idleTimeoutMillis: 30000,    // 30s idle timeout
        connectionTimeoutMillis: 5000, // 5s connection timeout (Railway proxy)
      },
    };

// Local development config: Use individual connection parameters
const developmentConfig: DataSourceOptions = {
  ...baseConfig,
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  username: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DB || 'courier_db',
};

// Select config based on environment
export const dataSourceOptions: DataSourceOptions = isProduction
  ? productionConfig
  : developmentConfig;

// Single log line for startup (reduce log spam)
if (process.env.NODE_ENV !== 'production') {
  console.log(
    `[DATABASE] ${isProduction ? 'Railway' : 'Local'} | DATABASE_URL: ${databaseUrl ? 'SET' : 'NOT SET'}`,
  );
}

// Database configuration logging
console.log('');
console.log('='.repeat(60));
console.log('[DATABASE CONFIG]');
console.log('='.repeat(60));
console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`Mode: ${isTs ? 'TypeScript' : 'JavaScript (compiled)'}`);
console.log(`DATABASE_URL: ${databaseUrl ? '✅ SET' : '❌ NOT SET'}`);
console.log(`FORCE_SYNC: ${forceSync ? '⚠️  ENABLED (will auto-create tables!)' : '❌ DISABLED'}`);
console.log(`Synchronize: ${baseConfig.synchronize ? '✅ ENABLED' : '❌ DISABLED'}`);

if (forceSync) {
  console.log('');
  console.log('🔄 FORCE_SYNC is ENABLED - TypeORM will auto-create/update ALL tables!');
  console.log('   This should only be used for:');
  console.log('   - First deployment to create all tables');
  console.log('   - Fixing missing tables after migration issues');
  console.log('   ⚠️  Remove FORCE_SYNC env var after tables are created!');
  console.log('');
}

// Show paths being used
console.log(`Migration Path: ${JSON.stringify(dataSourceOptions.migrations)}`);
console.log(`Entity Path: ${JSON.stringify(dataSourceOptions.entities)}`);

// Show connection details
if (databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    console.log(`Database Host: ${url.hostname}`);
    console.log(`Database Port: ${url.port || '5432'}`);
    console.log(`Database Name: ${url.pathname.substring(1)}`);
    console.log(`Database User: ${url.username}`);
  } catch (e) {
    console.error('⚠️  Failed to parse DATABASE_URL:', e.message);
  }
} else if (isProduction) {
  console.warn('⚠️  WARNING: Running in production but DATABASE_URL is not set!');
}

console.log('='.repeat(60));
console.log('');

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
