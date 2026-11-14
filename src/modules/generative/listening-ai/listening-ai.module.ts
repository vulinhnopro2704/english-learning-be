import { Module } from '@nestjs/common';
import { ListeningAiController } from './listening-ai.controller';
import { ListeningAiService } from './listening-ai.service';
import { OllamaModule } from '../ollama/ollama.module';

@Module({
  imports: [OllamaModule],
  controllers: [ListeningAiController],
  providers: [ListeningAiService],
  exports: [ListeningAiService],
})
export class ListeningAiModule {}
