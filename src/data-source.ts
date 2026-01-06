import { DataSource, DataSourceOptions } from 'typeorm';
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

// Check if running on Railway
const isProduction = !!(process.env.RAILWAY_PRIVATE_DOMAIN || databaseUrl);

// Base configuration shared across environments
const baseConfig = {
  type: 'postgres' as const,
  entities: isTs
    ? [path.join(__dirname, '**/*.entity.ts')]
    : ['dist/**/*.entity.js'],
  migrations: isTs
    ? [path.join(__dirname, 'migrations/*.ts')]
    : ['dist/migrations/*.js'],
  synchronize: false,
  logging: false,
  migrationsRun: true, // Auto-run migrations on app start
};

// Railway/Production config: Use DATABASE_URL directly if available
const productionConfig: DataSourceOptions = databaseUrl
  ? {
      ...baseConfig,
      url: databaseUrl,
      ssl: { rejectUnauthorized: false },
      extra: {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        ssl: {
          rejectUnauthorized: false,
        },
      },
    }
  : {
      ...baseConfig,
      host: process.env.PGHOST || process.env.RAILWAY_PRIVATE_DOMAIN,
      port: parseInt(process.env.PGPORT || '5432', 10),
      username: process.env.PGUSER || process.env.POSTGRES_USER || 'postgres',
      password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD,
      database: process.env.PGDATABASE || process.env.POSTGRES_DB || 'railway',
      ssl: { rejectUnauthorized: false },
      extra: {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        ssl: {
          rejectUnauthorized: false,
        },
      },
    };

// Local development config: Use individual connection parameters
const developmentConfig: DataSourceOptions = {
  ...baseConfig,
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  username: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'password',
  database: process.env.PG_DB || 'courier_db',
};

// Select config based on environment
export const dataSourceOptions: DataSourceOptions = isProduction ? productionConfig : developmentConfig;

// Database configuration logging
if (process.env.NODE_ENV !== 'production') {
  console.log(`[DATABASE] ${isProduction ? 'Railway' : 'Local'} | DATABASE_URL: ${databaseUrl ? 'SET' : 'NOT SET'}`);
  
  // Show connection details in development
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      console.log(`[DATABASE] Connecting to: ${url.hostname}:${url.port || 5432}`);
      console.log(`[DATABASE] Database: ${url.pathname.substring(1)}`);
      console.log(`[DATABASE] User: ${url.username}`);
    } catch (e) {
      console.error('[DATABASE] Failed to parse DATABASE_URL:', e.message);
    }
  } else if (isProduction) {
    console.warn('[DATABASE] WARNING: Running in production but DATABASE_URL is not set!');
  }
}

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
