import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class StorageService {
  constructor(private prisma: PrismaService) {}
}
