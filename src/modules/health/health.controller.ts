import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness and readiness check for server, database, and Redis' })
  @ApiResponse({ status: 200, description: 'All systems operational' })
  @ApiResponse({ status: 503, description: 'One or more systems degraded' })
  async check(@Res() res: Response) {
    const startTime = Date.now();
    let dbStatus = 'down';
    let redisStatus = 'down';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'up';
    } catch {
      dbStatus = 'down';
    }

    try {
      const ping = await this.redisService.get('__health_ping__');
      redisStatus = 'up';
    } catch {
      redisStatus = 'down';
    }

    const isHealthy = dbStatus === 'up';
    const status = isHealthy ? 'ok' : 'degraded';
    const httpStatus = isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(httpStatus).json({
      status,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    });
  }
}
