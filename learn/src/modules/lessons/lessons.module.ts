import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { ProgressModule } from '../progress/progress.module';
import { StreakModule } from '../streak/streak.module';

@Module({
  imports: [ProgressModule, StreakModule],
  providers: [LessonsService],
  controllers: [LessonsController],
  exports: [LessonsService],
})
export class LessonsModule {}
