import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'], // enable all log levels
  });

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // strip properties not in the DTO
      forbidNonWhitelisted: true, // throw if unknown properties are sent
      transform: true,       // auto-transform payload to DTO class instance
      transformOptions: {
        enableImplicitConversion: true, // convert string "3000" to number 3000
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.BROKER_PORT ?? 3000;
  await app.listen(port);

  logger.log(`Message broker running on port ${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
  logger.log(`WebSocket gateway ready`);

  // Handle shutdown signals
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received — shutting down gracefully');
    await app.close();
    process.exit(0);
  });
}



bootstrap();