import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();
  const port = process.env.SHIPPING_SERVICE_PORT || 3009;
  await app.listen(port);
  console.log(`Shipping service running on port ${port}`);
}
bootstrap();
