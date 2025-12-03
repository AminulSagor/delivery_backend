import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

// Detect if running via ts-node (development) or compiled js (production)
const isTs = __filename.endsWith('.ts');

// Check if DATABASE_URL is set (Railway/Production)
const databaseUrl =
  process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL;

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

// Railway/Production config: Use DATABASE_URL with SSL
const productionConfig: DataSourceOptions = {
  ...baseConfig,
  url: databaseUrl || '',
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
  host: process.env.PGHOST || process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PGPORT || process.env.PG_PORT || '5432', 10),
  username:
    process.env.PGUSER ||
    process.env.POSTGRES_USER ||
    process.env.PG_USER ||
    'postgres',
  password:
    process.env.PGPASSWORD ||
    process.env.POSTGRES_PASSWORD ||
    process.env.PG_PASSWORD ||
    'password',
  database:
    process.env.PGDATABASE ||
    process.env.POSTGRES_DB ||
    process.env.PG_DB ||
    'courier_db',
};

// Select config based on environment
export const dataSourceOptions: DataSourceOptions = databaseUrl
  ? productionConfig
  : developmentConfig;

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
