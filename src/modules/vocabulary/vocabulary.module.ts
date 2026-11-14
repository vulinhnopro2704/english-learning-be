import { Module } from '@nestjs/common';
import { StreakModule } from '../streak/streak.module';
import { FsrsModule } from '../fsrs/fsrs.module';
import { VocabularyService } from './vocabulary.service';
import { VocabularyController } from './vocabulary.controller';

@Module({
  imports: [StreakModule, FsrsModule],
  providers: [VocabularyService],
  controllers: [VocabularyController],
  exports: [VocabularyService],
})
export class VocabularyModule {}
