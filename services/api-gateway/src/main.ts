import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { RequestLoggingInterceptor } from '@exchange/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Validate critical config
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === 'exchange-jwt-secret-dev' || jwtSecret === 'default-secret') {
    logger.error('FATAL: JWT_SECRET is not set or is using an insecure default. Refusing to start.');
    process.exit(1);
  }

  // Disable body parser so raw request streams can be piped to backend services
  // (required for multipart file uploads to arrive intact)
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost')
    .split(',')
    .map(o => o.trim());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  const port = process.env.API_GATEWAY_PORT || 3000;
  await app.listen(port);
  logger.log(`API Gateway running on port ${port}`);
  logger.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
}
bootstrap();
