import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
  
  console.log('[BOOTSTRAP] Starting application...');
  console.log(`[BOOTSTRAP] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[BOOTSTRAP] Platform: ${isRailway ? 'Railway' : 'Local'}`);
  console.log(`[BOOTSTRAP] Port: ${process.env.PORT || 3000}`);
  
  const app = await NestFactory.create(AppModule, {
    logger: isProduction ? ['error', 'warn', 'log'] : ['log', 'error', 'warn', 'debug'],
    abortOnError: false, // Don't crash on startup errors
  });
  
  // Normalize URLs by removing double slashes (fixes production routing issues)
  // This handles cases where baseUrl has trailing slash and route starts with slash
  // Note: Only modify req.url, not req.path (which is read-only)
  app.use((req: any, res: any, next: any) => {
    if (req.url) {
      // Split URL and query string
      const [path, query] = req.url.split('?');
      // Replace multiple consecutive slashes with a single slash in path
      const normalizedPath = path.replace(/\/+/g, '/');
      // Ensure path starts with single slash
      const finalPath = normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath;
      // Reconstruct URL with query string if present
      // Express will automatically update req.path based on req.url
      req.url = query ? `${finalPath}?${query}` : finalPath;
    }
    next();
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
