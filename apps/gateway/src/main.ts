import { NestFactory } from '@nestjs/core';
import { GatewayModule } from './gateway.module.js';

async function bootstrap() {
  const app = await NestFactory.createMicroservice({
    module: GatewayModule,
  });
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
