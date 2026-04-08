import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './modules/db/db.module';
import { CoursesModule } from './modules/courses/courses.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { WordsModule } from './modules/words/words.module';
import { ProgressModule } from './modules/progress/progress.module';
import { VocabularyModule } from './modules/vocabulary/vocabulary.module';
import { StreakModule } from './modules/streak/streak.module';
import { PracticeModule } from './modules/practice/practice.module';
import { DictionaryModule } from './modules/dictionary/dictionary.module';
import { RedisModule } from './modules/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DbModule,
    RedisModule,
    CoursesModule,
    LessonsModule,
    WordsModule,
    ProgressModule,
    VocabularyModule,
    StreakModule,
    PracticeModule,
    DictionaryModule,
  ],
})
export class LearnModule {}
