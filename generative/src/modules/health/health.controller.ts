import { Controller, Get } from '@nestjs/common';
import {
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiOkEntityResponse,
  ApiStandardErrorResponses,
} from '@english-learning/nest-api-docs';
import { HealthService } from './health.service';

class HealthResponseDto {
  @ApiProperty({
    example: 'ok',
    description: 'Liveness status of this service process.',
  })
  status!: string;

  @ApiProperty({
    example: 'generative',
    description: 'Service identifier.',
  })
  service!: string;
}

class ReadinessChecksDto {
  @ApiProperty({
    example: 'ok',
    description: 'Redis dependency reachability result.',
  })
  redis!: string;
}

class ReadinessResponseDto {
  @ApiProperty({
    example: 'ready',
    description: 'Readiness status for accepting application traffic.',
  })
  status!: string;

  @ApiProperty({
    type: ReadinessChecksDto,
    description: 'Dependency check details used to determine readiness.',
  })
  checks!: {
    redis: string;
  };
}

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Liveness probe for generative service',
    description:
      'Simple process-level probe. Returns ok when API process is alive, regardless of dependency health.',
  })
  @ApiOkEntityResponse({
    type: HealthResponseDto,
    description: 'Service is alive',
  })
  @ApiResponse({
    status: 200,
    description: 'Liveness payload example.',
    content: {
      'application/json': {
        example: {
          status: 'ok',
          service: 'generative',
        },
      },
    },
  })
  @ApiStandardErrorResponses({ statuses: [500] })
  getHealth() {
    return this.healthService.getHealth();
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe including Redis connectivity',
    description:
      'Dependency-aware probe for orchestration and load balancers. Returns readiness details for Redis.',
  })
  @ApiOkEntityResponse({
    type: ReadinessResponseDto,
    description: 'Service readiness result',
  })
  @ApiResponse({
    status: 200,
    description: 'Readiness payload example when dependencies are healthy.',
    content: {
      'application/json': {
        example: {
          status: 'ready',
          checks: {
            redis: 'ok',
          },
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'Service dependencies are not ready.',
    content: {
      'application/json': {
        example: {
          statusCode: 503,
          errorCode: 'SERVICE_UNAVAILABLE',
          message: 'Redis dependency is unreachable',
        },
      },
    },
  })
  @ApiStandardErrorResponses({ statuses: [500, 503] })
  async getReadiness() {
    return this.healthService.getReadiness();
  }
}
