import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

@Module({
  controllers: [StorageController],
  providers: [CloudinaryService, StorageService],
  exports: [CloudinaryService, StorageService],
})
export class StorageModule {}
