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
async function fixStaleEnumTypes() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('[DB FIX] Skipping enum fix - no DATABASE_URL (local dev)');
    return;
  }

  console.log('[DB FIX] ========================================');
  console.log('[DB FIX] Starting CRITICAL enum type cleanup...');
  console.log('[DB FIX] ========================================');
  
  const tempDataSource = new DataSource({
    ...dataSourceOptions,
    synchronize: false, // ABSOLUTELY NO SYNC HERE
    migrationsRun: false,
    logging: true,
  });

  try {
    await tempDataSource.initialize();
    console.log('[DB FIX] Connected to database');
    
    // We'll run a single block of SQL to fix everything at once
    // This is more reliable than multiple query calls
    await tempDataSource.query(`
      DO $$ 
      BEGIN
        -- 1. Check if the old enum exists
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_recipient_type_enum_old') THEN
          RAISE NOTICE 'Found otp_recipient_type_enum_old, performing cleanup...';
          
          -- 2. Create the new enum if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_recipient_type_enum') THEN
            CREATE TYPE "otp_recipient_type_enum" AS ENUM ('MERCHANT', 'CUSTOMER');
          END IF;

          -- 3. Break dependencies by changing column types to TEXT
          -- We do this for all columns that might be using the old enum
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_verifications' AND column_name = 'otp_verified_by') THEN
            ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_verified_by" DROP DEFAULT;
            ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_verified_by" TYPE TEXT;
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_verifications' AND column_name = 'otp_recipient_type') THEN
            ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_recipient_type" DROP DEFAULT;
            ALTER TABLE "delivery_verifications" ALTER COLUMN "otp_recipient_type" TYPE TEXT;
          END IF;

          -- 4. Now we can safely drop the old enum with CASCADE
          DROP TYPE IF EXISTS "otp_recipient_type_enum_old" CASCADE;
          
          -- 5. Restore the columns to the new enum type
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_verifications' AND column_name = 'otp_verified_by') THEN
            ALTER TABLE "delivery_verifications" 
            ALTER COLUMN "otp_verified_by" TYPE "otp_recipient_type_enum" 
            USING "otp_verified_by"::"otp_recipient_type_enum";
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_verifications' AND column_name = 'otp_recipient_type') THEN
            ALTER TABLE "delivery_verifications" 
            ALTER COLUMN "otp_recipient_type" TYPE "otp_recipient_type_enum" 
            USING "otp_recipient_type"::"otp_recipient_type_enum";
          END IF;
          
          RAISE NOTICE 'Cleanup of otp_recipient_type_enum_old successful';
        END IF;

        -- Generic cleanup for any other _old enums that might be lying around
        -- This is safer than individual drops
        EXECUTE (
          SELECT COALESCE(string_agg('DROP TYPE IF EXISTS ' || quote_ident(typname) || ' CASCADE;', ' '), '-- no other old enums')
          FROM pg_type 
          WHERE typname LIKE '%_enum_old' 
          AND typtype = 'e'
        );
      END $$;
    `);

    await tempDataSource.destroy();
    console.log('[DB FIX] ========================================');
    console.log('[DB FIX] Enum cleanup block executed successfully');
    console.log('[DB FIX] ========================================');
  } catch (error) {
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
