import { Module } from '@nestjs/common';
import { LearnController } from './learn.controller.js';
import { LearnService } from './learn.service.js';
import { PrismaService } from './prisma.service.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [LearnController],
  providers: [LearnService, PrismaService],
})
export class LearnModule {}
