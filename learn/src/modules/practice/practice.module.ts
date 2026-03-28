import { Module } from '@nestjs/common';
import { PracticeService } from './practice.service';
import { PracticeController } from './practice.controller';
import { StreakModule } from '../streak/streak.module';

@Module({
  imports: [StreakModule],
  providers: [PracticeService],
  controllers: [PracticeController],
  exports: [PracticeService],
})
export class PracticeModule {}
