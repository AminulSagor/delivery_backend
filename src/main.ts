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

  console.log('[DB FIX] Checking for stale enum types...');
  
  const tempDataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    ssl: { rejectUnauthorized: false },
    synchronize: false,
    logging: false,
  });

  try {
    await tempDataSource.initialize();
    
    // Find all _old enum types that need cleanup
    const oldEnums = await tempDataSource.query(`
      SELECT typname FROM pg_type 
      WHERE typname LIKE '%_enum_old' 
      AND typtype = 'e'
    `);
    
    if (oldEnums.length === 0) {
      console.log('[DB FIX] No stale enum types found');
      await tempDataSource.destroy();
      return;
    }

    console.log(`[DB FIX] Found ${oldEnums.length} stale enum type(s): ${oldEnums.map(e => e.typname).join(', ')}`);

    for (const enumType of oldEnums) {
      const enumName = enumType.typname;
      const newEnumName = enumName.replace('_old', '');
      
      // Find columns using this old enum
      const dependentColumns = await tempDataSource.query(`
        SELECT 
          c.relname as table_name,
          a.attname as column_name
        FROM pg_attribute a
        JOIN pg_class c ON a.attrelid = c.oid
        JOIN pg_type t ON a.atttypid = t.oid
        WHERE t.typname = $1
        AND c.relkind = 'r'
      `, [enumName]);

      for (const col of dependentColumns) {
        console.log(`[DB FIX] Fixing column ${col.table_name}.${col.column_name} -> ${newEnumName}`);
        
        // Change column to use the new enum type
        await tempDataSource.query(`
          ALTER TABLE "${col.table_name}" 
          ALTER COLUMN "${col.column_name}" TYPE "${newEnumName}" 
          USING "${col.column_name}"::text::"${newEnumName}"
        `).catch(err => {
          console.log(`[DB FIX] Column already fixed or error: ${err.message}`);
        });
      }

      // Now drop the old enum type
      await tempDataSource.query(`DROP TYPE IF EXISTS "${enumName}" CASCADE`).catch(err => {
        console.log(`[DB FIX] Could not drop ${enumName}: ${err.message}`);
      });
      
      console.log(`[DB FIX] Cleaned up ${enumName}`);
    }

    await tempDataSource.destroy();
    console.log('[DB FIX] Enum cleanup complete');
  } catch (error) {
    console.error('[DB FIX] Error during enum fix:', error.message);
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
