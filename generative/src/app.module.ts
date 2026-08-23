import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './modules/redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { TutorSessionsModule } from './modules/tutor-sessions/tutor-sessions.module';
import { RoleplayModule } from './modules/roleplay/roleplay.module';
import { OllamaModule } from './modules/ollama/ollama.module';
import { ListeningAiModule } from './modules/listening-ai/listening-ai.module';

import { DbModule } from './modules/db/db.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    OllamaModule,
    DbModule,
    RedisModule,
    HealthModule,
    TutorSessionsModule,
    RoleplayModule,
    ListeningAiModule,
  ],
})
export class AppModule {}
