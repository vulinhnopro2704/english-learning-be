import { Module } from '@nestjs/common';
import { LearnController } from './learn.controller';
import { LearnService } from './learn.service';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [],
  controllers: [LearnController],
  providers: [LearnService, PrismaService],
})
export class LearnModule {}
