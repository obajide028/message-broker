import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const port = process.env.BROKER_PORT ?? 3000;
  await app.listen(port);

  logger.log(`Message broker running on port ${port}`);
  logger.log(`WebSocket gateway ready`);
}

bootstrap();