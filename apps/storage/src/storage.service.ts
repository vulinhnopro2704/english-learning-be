import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class StorageService {
  constructor(private prisma: PrismaService) {}
}
