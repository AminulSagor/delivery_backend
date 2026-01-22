import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { DataSource } from 'typeorm';

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
  console.log('[DB FIX] Starting enum type cleanup...');
  console.log('[DB FIX] ========================================');
  
  const tempDataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    ssl: { rejectUnauthorized: false },
    synchronize: false,
    logging: false,
  });

  try {
    await tempDataSource.initialize();
    console.log('[DB FIX] Connected to database');
    
    // DIRECT FIX: Handle the known problematic otp_recipient_type_enum_old
    // This is causing: "column otp_verified_by of table delivery_verifications depends on type otp_recipient_type_enum_old"
    console.log('[DB FIX] Checking for otp_recipient_type_enum_old...');
    
    const oldEnumExists = await tempDataSource.query(`
      SELECT 1 FROM pg_type WHERE typname = 'otp_recipient_type_enum_old'
    `);
    
    if (oldEnumExists.length > 0) {
      console.log('[DB FIX] Found otp_recipient_type_enum_old - fixing...');
      
      // Step 1: Check if new enum exists
      const newEnumExists = await tempDataSource.query(`
        SELECT 1 FROM pg_type WHERE typname = 'otp_recipient_type_enum'
      `);
      
      if (newEnumExists.length === 0) {
        // Create the new enum if it doesn't exist
        console.log('[DB FIX] Creating new enum otp_recipient_type_enum...');
        await tempDataSource.query(`
          CREATE TYPE "otp_recipient_type_enum" AS ENUM ('MERCHANT', 'CUSTOMER')
        `).catch(e => console.log('[DB FIX] Enum creation:', e.message));
      }
      
      // Step 2: Fix otp_verified_by column
      console.log('[DB FIX] Altering delivery_verifications.otp_verified_by column...');
      await tempDataSource.query(`
        ALTER TABLE "delivery_verifications" 
        ALTER COLUMN "otp_verified_by" TYPE VARCHAR(20)
      `).catch(e => console.log('[DB FIX] Step 2a:', e.message));
      
      await tempDataSource.query(`
        ALTER TABLE "delivery_verifications" 
        ALTER COLUMN "otp_verified_by" TYPE "otp_recipient_type_enum" 
        USING "otp_verified_by"::"otp_recipient_type_enum"
      `).catch(e => console.log('[DB FIX] Step 2b:', e.message));
      
      // Step 3: Fix otp_recipient_type column if needed
      console.log('[DB FIX] Checking otp_recipient_type column...');
      await tempDataSource.query(`
        ALTER TABLE "delivery_verifications" 
        ALTER COLUMN "otp_recipient_type" TYPE VARCHAR(20)
      `).catch(e => console.log('[DB FIX] Step 3a:', e.message));
      
      await tempDataSource.query(`
        ALTER TABLE "delivery_verifications" 
        ALTER COLUMN "otp_recipient_type" TYPE "otp_recipient_type_enum" 
        USING "otp_recipient_type"::"otp_recipient_type_enum"
      `).catch(e => console.log('[DB FIX] Step 3b:', e.message));
      
      // Step 4: Drop the old enum with CASCADE
      console.log('[DB FIX] Dropping old enum with CASCADE...');
      await tempDataSource.query(`
        DROP TYPE IF EXISTS "otp_recipient_type_enum_old" CASCADE
      `).catch(e => console.log('[DB FIX] Drop old enum:', e.message));
      
      console.log('[DB FIX] otp_recipient_type_enum_old cleanup complete!');
    } else {
      console.log('[DB FIX] No otp_recipient_type_enum_old found');
    }

    // Generic cleanup for any other _old enums
    const otherOldEnums = await tempDataSource.query(`
      SELECT typname FROM pg_type 
      WHERE typname LIKE '%_enum_old' 
      AND typtype = 'e'
    `);
    
    for (const enumType of otherOldEnums) {
      console.log(`[DB FIX] Dropping ${enumType.typname} with CASCADE...`);
      await tempDataSource.query(`DROP TYPE IF EXISTS "${enumType.typname}" CASCADE`)
        .catch(e => console.log(`[DB FIX] ${enumType.typname}:`, e.message));
    }

    await tempDataSource.destroy();
    console.log('[DB FIX] ========================================');
    console.log('[DB FIX] Enum cleanup complete!');
    console.log('[DB FIX] ========================================');
  } catch (error) {
    console.error('[DB FIX] CRITICAL ERROR:', error.message);
    console.error('[DB FIX] Stack:', error.stack);
    try {
      await tempDataSource.destroy();
    } catch {}
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
