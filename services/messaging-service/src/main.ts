import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors();
  const port = process.env.MESSAGING_SERVICE_PORT || 3011;
  await app.listen(port);
  console.log(`Messaging service running on port ${port}`);
}
bootstrap();
