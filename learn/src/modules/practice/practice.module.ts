import { Module } from '@nestjs/common';
import { PracticeService } from './practice.service';
import { PracticeController } from './practice.controller';
import { ProgressModule } from '../progress/progress.module';
import { StreakModule } from '../streak/streak.module';

@Module({
  imports: [ProgressModule, StreakModule],
  providers: [PracticeService],
  controllers: [PracticeController],
  exports: [PracticeService],
})
export class PracticeModule {}
