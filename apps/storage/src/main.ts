import 'dotenv';
import { NestFactory } from '@nestjs/core';
import { StorageModule } from './storage.module.js';

async function bootstrap() {
  const app = await NestFactory.create(StorageModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
