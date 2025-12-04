import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

// Detect if running via ts-node (development) or compiled js (production)
const isTs = __filename.endsWith('.ts');

// Check if DATABASE_URL is available (Railway provides this when you link a database)
const databaseUrl = process.env.DATABASE_URL;
const isProduction = !!databaseUrl;

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

// Railway/Production config: Use DATABASE_URL connection string
const productionConfig: DataSourceOptions = {
  ...baseConfig,
  url: databaseUrl,
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
export const dataSourceOptions: DataSourceOptions = isProduction ? productionConfig : developmentConfig;

// Log which config is being used (helpful for debugging)
console.log(`[DATABASE] Using ${isProduction ? 'Railway/Production' : 'Local/Development'} config`);
if (isProduction && databaseUrl) {
  // Log host from URL without exposing password
  const urlMatch = databaseUrl.match(/@([^:\/]+)/);
  console.log(`[DATABASE] Host: ${urlMatch ? urlMatch[1] : 'from DATABASE_URL'}`);
} else {
  console.log(`[DATABASE] Host: ${process.env.PG_HOST || 'localhost'}`);
}

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
