import { Global, Module } from '@nestjs/common';
import { OllamaService } from './ollama.service';

/**
 * Global Ollama module — provides OllamaService to the entire application.
 *
 * Import this module in AppModule. Because it is @Global(), all other modules
 * can inject OllamaService without explicitly importing OllamaModule.
 */
@Global()
@Module({
  providers: [OllamaService],
  exports: [OllamaService],
})
export class OllamaModule {}
