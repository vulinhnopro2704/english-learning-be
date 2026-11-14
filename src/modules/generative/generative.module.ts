import { Module } from '@nestjs/common';
import { OllamaModule } from './ollama/ollama.module';
import { LlmModule } from './llm/llm.module';
import { TtsModule } from './tts/tts.module';
import { SttModule } from './stt/stt.module';
import { RoleplayModule } from './roleplay/roleplay.module';
import { TutorSessionsModule } from './tutor-sessions/tutor-sessions.module';
import { ListeningAiModule } from './listening-ai/listening-ai.module';

@Module({
  imports: [
    OllamaModule,
    LlmModule,
    TtsModule,
    SttModule,
    RoleplayModule,
    TutorSessionsModule,
    ListeningAiModule,
  ],
  exports: [
    OllamaModule,
    LlmModule,
    TtsModule,
    SttModule,
    RoleplayModule,
    TutorSessionsModule,
    ListeningAiModule,
  ],
})
export class GenerativeModule {}
