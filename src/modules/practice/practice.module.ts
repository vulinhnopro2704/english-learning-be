import { Module } from '@nestjs/common';
import { PracticeService } from './practice.service';
import { PracticeController } from './practice.controller';
import { StreakModule } from '../streak/streak.module';
import { FsrsModule } from '../fsrs/fsrs.module';

@Module({
  imports: [StreakModule, FsrsModule],
  providers: [PracticeService],
  controllers: [PracticeController],
  exports: [PracticeService],
})
export class PracticeModule {}
