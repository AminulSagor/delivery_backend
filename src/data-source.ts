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
  console.error(
    '❌ CRITICAL ERROR: DATABASE_URL contains unresolved Railway template syntax!',
  );
  console.error('   Current value contains: ${{...}}');
  console.error('');
  console.error(
    '   This means the database is NOT properly linked to your web service.',
  );
  console.error('');
  console.error('🔧 FIX in Railway Dashboard:');
  console.error('   1. Go to your web service → Variables tab');
  console.error('   2. Delete the DATABASE_URL variable');
  console.error('   3. Click "New Variable" → "Add a Reference"');
  console.error('   4. Select PostgreSQL service → DATABASE_URL');
  console.error('   5. Redeploy');
  console.error('');
  console.error(
    '📖 See RAILWAY_DATABASE_CONNECTION_FIX.md for detailed instructions',
  );
  console.error('');
  throw new Error('DATABASE_URL contains unresolved Railway template syntax');
}

// Check if running on Railway or in production
const isProductionEnv = !!(
  process.env.NODE_ENV === 'production' ||
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.RAILWAY_PRIVATE_DOMAIN ||
  databaseUrl
);

// Synchronize: ALWAYS enabled for both development and production
// This auto-creates/updates all tables based on entities
// No manual migrations needed!
// SET DISABLE_SYNC=true to temporarily disable this if needed
const shouldSynchronize = process.env.DISABLE_SYNC !== 'true';

// Base configuration shared across environments
const baseConfig = {
  type: 'postgres' as const,
  entities: isTs
    ? [path.join(__dirname, '**/*.entity.ts')]
    : [path.join(__dirname, '**/*.entity.js')],
  migrations: isTs
    ? [path.join(__dirname, 'migrations/*.ts')]
    : [path.join(__dirname, 'migrations/*.js')],
  // synchronize: Auto-creates/updates tables based on entities
  // Development: always enabled | Production: only with FORCE_SYNC
  synchronize: shouldSynchronize,
  logging: (shouldSynchronize
    ? ['schema', 'error', 'warn']
    : false) as LoggerOptions,
};

// Railway/Production config: Use DATABASE_URL directly if available
// Railway TCP Proxy: SSL configuration based on connection string or environment
const productionConfig: DataSourceOptions = databaseUrl
  ? {
      ...baseConfig,
      url: databaseUrl,
      // Check if DATABASE_URL contains sslmode=disable
      ssl: databaseUrl.includes('sslmode=disable')
        ? false
        : {
            rejectUnauthorized: false,
          },
      extra: {
        max: 5, // Small pool for Railway limits
        idleTimeoutMillis: 30000, // 30s idle timeout
        connectionTimeoutMillis: 10000, // 10s connection timeout
      },
    }
  : {
      ...baseConfig,
      host: process.env.PGHOST || process.env.RAILWAY_PRIVATE_DOMAIN,
      port: parseInt(process.env.PGPORT || '5432', 10),
      username: process.env.PGUSER || process.env.POSTGRES_USER || 'postgres',
      password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD,
      database: process.env.PGDATABASE || process.env.POSTGRES_DB || 'railway',
      ssl:
        process.env.PGSSLMODE === 'disable'
          ? false
          : {
              rejectUnauthorized: false,
            },
      extra: {
        max: 5, // Small pool for Railway limits
        idleTimeoutMillis: 30000, // 30s idle timeout
        connectionTimeoutMillis: 10000, // 10s connection timeout
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
export const dataSourceOptions: DataSourceOptions = isProductionEnv
  ? productionConfig
  : developmentConfig;

// Single log line for startup (reduce log spam)
if (process.env.NODE_ENV !== 'production') {
  console.log(
    `[DATABASE] ${isProductionEnv ? 'Railway' : 'Local'} | DATABASE_URL: ${databaseUrl ? 'SET' : 'NOT SET'}`,
  );
}

// Database configuration logging
console.log('');
console.log('='.repeat(60));
console.log('[DATABASE CONFIG]');
console.log('='.repeat(60));
console.log(`Environment: ${isProductionEnv ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`Mode: ${isTs ? 'TypeScript' : 'JavaScript (compiled)'}`);
console.log(`DATABASE_URL: ${databaseUrl ? '✅ SET' : '❌ NOT SET'}`);
console.log(`Synchronize: ✅ ALWAYS ENABLED (auto-sync schema)`);
console.log('');
console.log(
  '🔄 SYNCHRONIZE is ENABLED - TypeORM will auto-create/update ALL tables!',
);
console.log(
  '   ℹ️  No manual migrations needed. Schema syncs automatically on startup.',
);
console.log('');

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
} else if (isProductionEnv) {
  console.warn(
    '⚠️  WARNING: Running in production but DATABASE_URL is not set!',
  );
}

console.log('='.repeat(60));
console.log('');

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
