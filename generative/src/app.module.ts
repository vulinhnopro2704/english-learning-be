import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './modules/redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { TutorSessionsModule } from './modules/tutor-sessions/tutor-sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RedisModule,
    HealthModule,
    TutorSessionsModule,
  ],
})
export class AppModule {}
