import { Module } from '@nestjs/common';
import { TutorSessionsController } from './tutor-sessions.controller';
import { TutorSessionsService } from './tutor-sessions.service';
import { LlmModule } from '../llm/llm.module';
import { TtsModule } from '../tts/tts.module';
import { SttModule } from '../stt/stt.module';
import { AvatarBehaviorService } from './avatar-behavior.service';

@Module({
  imports: [LlmModule, TtsModule, SttModule],
  controllers: [TutorSessionsController],
  providers: [TutorSessionsService, AvatarBehaviorService],
})
export class TutorSessionsModule {}
