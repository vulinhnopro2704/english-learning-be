import { NestFactory } from '@nestjs/core';
import { LearnModule } from './learn.module';

async function bootstrap() {
  const app = await NestFactory.create(LearnModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
