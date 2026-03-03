import { Module } from '@nestjs/common';
import { ProgressService } from './progress.service.js';
import { ProgressController } from './progress.controller.js';

@Module({
  providers: [ProgressService],
  controllers: [ProgressController],
  exports: [ProgressService],
})
export class ProgressModule {}
