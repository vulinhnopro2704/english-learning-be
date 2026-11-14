import { Module } from '@nestjs/common';
import { FsrsController } from './fsrs.controller';
import { FsrsSchedulerService } from './services/fsrs-scheduler.service';
import { FsrsOptimizerService } from './services/fsrs-optimizer.service';
import { FsrsReportService } from './services/fsrs-report.service';

@Module({
  controllers: [FsrsController],
  providers: [FsrsSchedulerService, FsrsOptimizerService, FsrsReportService],
  exports: [FsrsSchedulerService, FsrsOptimizerService, FsrsReportService],
})
export class FsrsModule {}
