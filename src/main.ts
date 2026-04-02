import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';

/**
 * Fix stale enum types and orphan data before TypeORM synchronize runs.
 * This is a critical startup fix for Railway deployment stability.
 *
 * TEMPORARILY DISABLED FOR LOCAL DEVELOPMENT
 */
async function runDatabaseFixes() {
  console.log('[DB FIX] ========================================');
  console.log('[DB FIX] Database fixes DISABLED for local development');
  console.log('[DB FIX] (Enable in production if needed)');
  console.log('[DB FIX] ========================================');

  // Skip fixes for now to avoid pg library issues
  return Promise.resolve();

  /* COMMENTED OUT TEMPORARILY
  const tempDataSource = new DataSource({
    ...dataSourceOptions,
    synchronize: false,
    migrationsRun: false,
    logging: false,
  });

  try {
    await tempDataSource.initialize();
    console.log('[DB FIX] Connected to database');
    
    // 1. COMPREHENSIVE ENUM CLEANUP
    // This script finds ANY column using an enum ending in '_old' and fixes it
    await tempDataSource.query(`
      DO $$ 
      DECLARE
        r RECORD;
        enum_record RECORD;
        column_record RECORD;
      BEGIN
        -- A. Handle known problematic otp_recipient_type_enum_old first
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_recipient_type_enum_old') THEN
          RAISE NOTICE 'Found otp_recipient_type_enum_old, performing specific cleanup...';
          
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_recipient_type_enum') THEN
            CREATE TYPE "otp_recipient_type_enum" AS ENUM ('MERCHANT', 'CUSTOMER');
          END IF;

          -- Break all possible dependencies in delivery_verifications
          PERFORM 1 FROM information_schema.columns WHERE table_name = 'delivery_verifications' AND column_name = 'otp_verified_by';
          IF FOUND THEN
            EXECUTE 'ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_verified_by" DROP DEFAULT';
            EXECUTE 'ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_verified_by" TYPE TEXT';
          END IF;

          PERFORM 1 FROM information_schema.columns WHERE table_name = 'delivery_verifications' AND column_name = 'otp_recipient_type';
          IF FOUND THEN
            EXECUTE 'ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_recipient_type" DROP DEFAULT';
            EXECUTE 'ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_recipient_type" TYPE TEXT';
          END IF;

          -- Force drop the old type
          DROP TYPE IF EXISTS "otp_recipient_type_enum_old" CASCADE;
          
          -- Re-cast columns to the new enum type
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_verifications' AND column_name = 'otp_verified_by') THEN
            EXECUTE 'ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_verified_by" TYPE "otp_recipient_type_enum" USING "otp_verified_by"::"otp_recipient_type_enum"';
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_verifications' AND column_name = 'otp_recipient_type') THEN
            EXECUTE 'ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_recipient_type" TYPE "otp_recipient_type_enum" USING "otp_recipient_type"::"otp_recipient_type_enum"';
          END IF;
        END IF;

        -- B. Generic cleanup for ANY other stale enum types ending in _old
        FOR enum_record IN (SELECT typname FROM pg_type WHERE typname LIKE '%_enum_old' AND typtype = 'e') LOOP
          RAISE NOTICE 'Generic cleanup for stale enum: %', enum_record.typname;
          
          -- Find any columns still using this stale type and break dependency
          FOR column_record IN (
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE udt_name = enum_record.typname
          ) LOOP
            RAISE NOTICE 'Breaking dependency on %.%', column_record.table_name, column_record.column_name;
            EXECUTE 'ALTER TABLE ' || quote_ident(column_record.table_name) || 
                    ' ALTER COLUMN ' || quote_ident(column_record.column_name) || ' TYPE TEXT';
          END LOOP;

          -- Drop the type
          EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(enum_record.typname) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    console.log('[DB FIX] Enum cleanup completed');
    await tempDataSource.query(`
      DO $$ 
      DECLARE
        r RECORD;
        enum_record RECORD;
        column_record RECORD;
      BEGIN
        -- A. Handle known problematic otp_recipient_type_enum_old first
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_recipient_type_enum_old') THEN
          RAISE NOTICE 'Found otp_recipient_type_enum_old, performing specific cleanup...';
          
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_recipient_type_enum') THEN
            CREATE TYPE "otp_recipient_type_enum" AS ENUM ('MERCHANT', 'CUSTOMER');
          END IF;

          -- Break all possible dependencies in delivery_verifications
          PERFORM 1 FROM information_schema.columns WHERE table_name = 'delivery_verifications' AND column_name = 'otp_verified_by';
          IF FOUND THEN
            EXECUTE 'ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_verified_by" DROP DEFAULT';
            EXECUTE 'ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_verified_by" TYPE TEXT';
          END IF;

          PERFORM 1 FROM information_schema.columns WHERE table_name = 'delivery_verifications' AND column_name = 'otp_recipient_type';
          IF FOUND THEN
            EXECUTE 'ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_recipient_type" DROP DEFAULT';
            EXECUTE 'ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_recipient_type" TYPE TEXT';
          END IF;

          -- Force drop the old type
          DROP TYPE IF EXISTS "otp_recipient_type_enum_old" CASCADE;
          
          -- Re-cast columns to the new enum type
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_verifications' AND column_name = 'otp_verified_by') THEN
            EXECUTE 'ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_verified_by" TYPE "otp_recipient_type_enum" USING "otp_verified_by"::"otp_recipient_type_enum"';
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_verifications' AND column_name = 'otp_recipient_type') THEN
            EXECUTE 'ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_recipient_type" TYPE "otp_recipient_type_enum" USING "otp_recipient_type"::"otp_recipient_type_enum"';
          END IF;
        END IF;

        -- B. Generic cleanup for ANY other stale enum types ending in _old
        FOR enum_record IN (SELECT typname FROM pg_type WHERE typname LIKE '%_enum_old' AND typtype = 'e') LOOP
          RAISE NOTICE 'Generic cleanup for stale enum: %', enum_record.typname;
          
          -- Find any columns still using this stale type and break dependency
          FOR column_record IN (
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE udt_name = enum_record.typname
          ) LOOP
            RAISE NOTICE 'Breaking dependency on %.%', column_record.table_name, column_record.column_name;
            EXECUTE 'ALTER TABLE ' || quote_ident(column_record.table_name) || 
                    ' ALTER COLUMN ' || quote_ident(column_record.column_name) || ' TYPE TEXT';
          END LOOP;

          -- Drop the type
          EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(enum_record.typname) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    console.log('[DB FIX] Enum cleanup completed');

    // 2. DATA INTEGRITY CLEANUP
    // Delete orphan parcels that violate foreign key constraints (merchant_id)
    console.log('[DB FIX] Checking for orphan parcel records...');
    const result = await tempDataSource.query(`
      SELECT COUNT(*) as count FROM parcels p 
      WHERE p.merchant_id IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM merchants m WHERE m.id = p.merchant_id)
    `);
    
    const orphanCount = parseInt(result[0].count);
    if (orphanCount > 0) {
      console.log(`[DB FIX] Found ${orphanCount} orphan parcels. Deleting...`);
      await tempDataSource.query(`
        DELETE FROM parcels 
        WHERE merchant_id IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM merchants m WHERE m.id = parcels.merchant_id)
      `);
      console.log('[DB FIX] Orphan parcels deleted successfully');
    } else {
      console.log('[DB FIX] No orphan parcels found');
    }

    await tempDataSource.destroy();
    console.log('[DB FIX] ========================================');
    console.log('[DB FIX] Database fixes completed successfully');
    console.log('[DB FIX] ========================================');
  } catch (error) {
    console.error('[DB FIX] CRITICAL ERROR during database fixes:', error.message);
    try {
      if (tempDataSource.isInitialized) await tempDataSource.destroy();
    } catch {}
  }
  END COMMENTED OUT */
}

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isRailway = !!process.env.RAILWAY_ENVIRONMENT;

  console.log('[BOOTSTRAP] Starting application...');
  console.log(
    `[BOOTSTRAP] Environment: ${process.env.NODE_ENV || 'development'}`,
  );
  console.log(`[BOOTSTRAP] Platform: ${isRailway ? 'Railway' : 'Local'}`);
  console.log(`[BOOTSTRAP] Port: ${process.env.PORT || 3000}`);

  // Run database fixes BEFORE NestJS/TypeORM starts
  await runDatabaseFixes();

  const app = await NestFactory.create(AppModule, {
    logger: isProduction
      ? ['error', 'warn', 'log']
      : ['log', 'error', 'warn', 'debug'],
    abortOnError: false,
  });

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,Accept',
    credentials: true,
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new ResponseInterceptor(),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(
    `🚀 Server running on port ${port} [${process.env.NODE_ENV || 'development'}]`,
  );
}
bootstrap();
