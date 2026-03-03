import { Module } from '@nestjs/common';
import { VocabularyService } from './vocabulary.service.js';
import { VocabularyController } from './vocabulary.controller.js';

@Module({
  providers: [VocabularyService],
  controllers: [VocabularyController],
  exports: [VocabularyService],
})
export class VocabularyModule {}
