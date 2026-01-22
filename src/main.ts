import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';

/**
 * Fix stale enum types before TypeORM synchronize runs
 * This handles the "_old" enum type leftovers from previous sync attempts
 */
/**
 * Fix stale enum types before TypeORM synchronize runs
 * This handles the "_old" enum type leftovers from previous sync attempts
 */
async function fixStaleEnumTypes() {
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
  
  console.log('[DB FIX] ========================================');
  console.log('[DB FIX] Starting CRITICAL enum type cleanup...');
  console.log('[DB FIX] ========================================');
  
  // Use the SAME options as the main application
  const tempDataSource = new DataSource({
    ...dataSourceOptions,
    synchronize: false, 
    migrationsRun: false,
    logging: true,
  });

  try {
    await tempDataSource.initialize();
    console.log('[DB FIX] Connected to database');
    
    // DIRECT FIX: Handle the known problematic otp_recipient_type_enum_old
    // and any other _old enums. We use CASCADE to force drop dependencies.
    await tempDataSource.query(`
      DO $$ 
      DECLARE
        r RECORD;
      BEGIN
        -- 1. Fix delivery_verifications dependency specifically
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_recipient_type_enum_old') THEN
          RAISE NOTICE 'Found otp_recipient_type_enum_old, performing cleanup...';
          
          -- Create the new enum if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_recipient_type_enum') THEN
            CREATE TYPE "otp_recipient_type_enum" AS ENUM ('MERCHANT', 'CUSTOMER');
          END IF;

          -- Break dependencies by changing column types to TEXT temporarily
          -- This is the critical part that prevents "cannot drop type" errors
          EXECUTE 'ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_verified_by" TYPE TEXT';
          EXECUTE 'ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_recipient_type" TYPE TEXT';

          -- Now we can safely drop the old enum with CASCADE
          DROP TYPE IF EXISTS "otp_recipient_type_enum_old" CASCADE;
          
          -- Restore the columns to the new enum type
          EXECUTE 'ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_verified_by" TYPE "otp_recipient_type_enum" USING "otp_verified_by"::"otp_recipient_type_enum"';
          EXECUTE 'ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_recipient_type" TYPE "otp_recipient_type_enum" USING "otp_recipient_type"::"otp_recipient_type_enum"';
          
          RAISE NOTICE 'Cleanup of otp_recipient_type_enum_old successful';
        END IF;

        -- 2. Generic cleanup for ANY other _old enums that might be lying around
        -- We find them and drop them with CASCADE
        FOR r IN (SELECT typname FROM pg_type WHERE typname LIKE '%_enum_old' AND typtype = 'e') LOOP
          RAISE NOTICE 'Dropping stale enum % with CASCADE', r.typname;
          EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    // DATA CLEANUP: Fix orphan parcels that prevent foreign key creation
    console.log('[DB FIX] Checking for orphan parcel records...');
    const orphanParcels = await tempDataSource.query(`
      SELECT id FROM parcels p 
      WHERE p.merchant_id IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.merchant_id)
    `);
    
    if (orphanParcels.length > 0) {
      console.log(`[DB FIX] Found ${orphanParcels.length} orphan parcels. Deleting...`);
      await tempDataSource.query(`
        DELETE FROM parcels 
        WHERE merchant_id IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = parcels.merchant_id)
      `);
      console.log('[DB FIX] Orphan parcels deleted.');
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
}
    console.error('[DB FIX] CRITICAL ERROR during enum fix:', error.message);
    try {
      await tempDataSource.destroy();
    } catch {}
    // If this fails, we might want to know why but let the app try to start anyway
  }
}

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
  
  console.log('[BOOTSTRAP] Starting application...');
  console.log(`[BOOTSTRAP] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[BOOTSTRAP] Platform: ${isRailway ? 'Railway' : 'Local'}`);
  console.log(`[BOOTSTRAP] Port: ${process.env.PORT || 3000}`);

  // Fix stale enum types before TypeORM synchronize runs
  await fixStaleEnumTypes();
  
  const app = await NestFactory.create(AppModule, {
    logger: isProduction ? ['error', 'warn', 'log'] : ['log', 'error', 'warn', 'debug'],
    abortOnError: false, // Don't crash on startup errors
  });

  // Enable CORS for all origins (configure as needed for production)
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  
  // Global exception filter for consistent error responses
  app.useGlobalFilters(new HttpExceptionFilter());
  
  // Global interceptors
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new ResponseInterceptor(),
  );
  
  // Global validation pipe with detailed error messages
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
  console.log(`🚀 Server running on port ${port} [${process.env.NODE_ENV || 'development'}]`);
}
bootstrap();
