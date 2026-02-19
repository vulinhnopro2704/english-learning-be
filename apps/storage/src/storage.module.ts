import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageController } from './storage.controller.js';
import { StorageService } from './storage.service.js';
import { PrismaService } from './prisma.service.js';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [StorageController],
  providers: [StorageService, PrismaService],
})
export class StorageModule {}
