import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

// Detect if running via ts-node (development) or compiled js (production)
const isTs = __filename.endsWith('.ts');

// Check for DATABASE_URL first (Railway provides this)
const databaseUrl = process.env.DATABASE_URL;

// Check if running on Railway
const isRailway = !!(process.env.RAILWAY_PRIVATE_DOMAIN || databaseUrl);

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
  logging: process.env.NODE_ENV === 'development',
};

// Railway/Production config: Use DATABASE_URL directly if available
const productionConfig: DataSourceOptions = databaseUrl
  ? {
      ...baseConfig,
      url: databaseUrl,
      ssl: { rejectUnauthorized: false },
      extra: {
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
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
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
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
export const dataSourceOptions: DataSourceOptions = isRailway ? productionConfig : developmentConfig;

// Log which config is being used (helpful for debugging)
console.log(`[DATABASE] Using ${isRailway ? 'Railway/Production' : 'Local/Development'} config`);
console.log(`[DATABASE] DATABASE_URL env: ${databaseUrl ? 'SET' : 'NOT SET'}`);
if (databaseUrl) {
  // Extract host from URL for logging (hide password)
  const match = databaseUrl.match(/@([^:]+):(\d+)\//);
  if (match) {
    console.log(`[DATABASE] Connecting to: ${match[1]}:${match[2]}`);
  }
} else if (isRailway) {
  console.log(`[DATABASE] Host: ${process.env.PGHOST || process.env.RAILWAY_PRIVATE_DOMAIN}`);
} else {
  console.log(`[DATABASE] Host: ${process.env.PG_HOST || 'localhost'}`);
}

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
