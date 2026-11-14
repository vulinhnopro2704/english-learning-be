import { Module } from '@nestjs/common';
import { RoleplayController } from './roleplay.controller';
import { RoleplayService } from './roleplay.service';
import { TtsModule } from '../tts/tts.module';
import { SttModule } from '../stt/stt.module';

@Module({
  imports: [TtsModule, SttModule],
  controllers: [RoleplayController],
  providers: [RoleplayService],
})
export class RoleplayModule {}
