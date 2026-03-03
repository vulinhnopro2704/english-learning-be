import { Module } from '@nestjs/common';
import { WordsService } from './words.service.js';
import { WordsController } from './words.controller.js';

@Module({
  providers: [WordsService],
  controllers: [WordsController],
  exports: [WordsService],
})
export class WordsModule {}
