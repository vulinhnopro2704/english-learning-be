import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './modules/db/db.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CoursesModule } from './modules/courses/courses.module.js';
import { LessonsModule } from './modules/lessons/lessons.module.js';
import { WordsModule } from './modules/words/words.module.js';
import { ProgressModule } from './modules/progress/progress.module.js';
import { VocabularyModule } from './modules/vocabulary/vocabulary.module.js';
import { StreakModule } from './modules/streak/streak.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: 'apps/learn/.env',
    }),
    DbModule,
    AuthModule,
    // Content CRUD
    CoursesModule,
    LessonsModule,
    WordsModule,
    // User Learning
    ProgressModule,
    VocabularyModule,
    StreakModule,
  ],
})
export class LearnModule {}
