import { Module } from '@nestjs/common';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { ProgressModule } from '../progress/progress.module';
import { StreakModule } from '../streak/streak.module';
import { FsrsModule } from '../fsrs/fsrs.module';

@Module({
  imports: [ProgressModule, StreakModule, FsrsModule],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
