import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Core infrastructure
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';

// Application modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CoursesModule } from './modules/courses/courses.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { WordsModule } from './modules/words/words.module';
import { VocabularyModule } from './modules/vocabulary/vocabulary.module';
import { DictionaryModule } from './modules/dictionary/dictionary.module';
import { ProgressModule } from './modules/progress/progress.module';
import { StreakModule } from './modules/streak/streak.module';
import { PracticeModule } from './modules/practice/practice.module';
import { FsrsModule } from './modules/fsrs/fsrs.module';
import { ListeningModule } from './modules/listening/listening.module';
import { StorageModule } from './modules/storage/storage.module';
import { GenerativeModule } from './modules/generative/generative.module';
import { NotificationModule } from './modules/notification/notification.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate Limiting (120 reqs/min per IP)
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),

    // Global Singletons
    DatabaseModule,
    RedisModule,

    // Domain & Feature Modules
    AuthModule,
    UsersModule,
    CoursesModule,
    LessonsModule,
    WordsModule,
    VocabularyModule,
    DictionaryModule,
    ProgressModule,
    StreakModule,
    PracticeModule,
    FsrsModule,
    ListeningModule,
    StorageModule,
    GenerativeModule,
    NotificationModule,
    HealthModule,
  ],
  providers: [
    // Global Exception Filter
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
    // Global Rate Limiting Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global JWT Authentication Guard (respects @Public() decorator)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Role-Based Access Control Guard
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
