import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const connectionString = process.env.DATABASE_LEARN_URL;
    if (!connectionString) {
      throw new Error('DATABASE_LEARN_URL environment variable is not set');
    }
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }
}
