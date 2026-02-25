import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const connectionString = process.env.DATABASE_AUTH_URL;
    if (!connectionString) {
      throw new Error('DATABASE_AUTH_URL environment variable is not set');
    }
    const adapter = new PrismaPg({ connectionString, schema: 'auth' });
    super({ adapter });
  }
}
