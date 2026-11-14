import { Module } from '@nestjs/common';
import { ListeningController } from './listening.controller';
import { ListeningService } from './listening.service';
import { YouTubeService } from './services/youtube.service';
import { BlankGeneratorService } from './services/blank-generator.service';

@Module({
  controllers: [ListeningController],
  providers: [ListeningService, YouTubeService, BlankGeneratorService],
  exports: [ListeningService, YouTubeService, BlankGeneratorService],
})
export class ListeningModule {}
