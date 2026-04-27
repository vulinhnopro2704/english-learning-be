import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './modules/redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { TutorSessionsModule } from './modules/tutor-sessions/tutor-sessions.module';
import { RoleplayModule } from './modules/roleplay/roleplay.module';

import { DbModule } from './modules/db/db.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DbModule,
    RedisModule,
    HealthModule,
    TutorSessionsModule,
    RoleplayModule,
  ],
})
export class AppModule {}
