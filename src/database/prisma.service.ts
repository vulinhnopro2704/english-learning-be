import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

/**
 * Unified Prisma database service managing multi-schema connection to PostgreSQL.
 * Handles graceful connection, disconnection, and logging.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    const connectionString =
      configService.get<string>('DATABASE_URL') ||
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/english_learning?schema=public';

    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  /**
   * Connects to the database when the module initializes.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Database connected successfully (multi-schema PostgreSQL)');
    } catch (error) {
      this.logger.error(
        `Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Disconnects from the database when the application shuts down.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected successfully');
  }
}
