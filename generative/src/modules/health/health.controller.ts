import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiOkEntityResponse,
  ApiStandardErrorResponses,
} from '@english-learning/nest-api-docs';
import { HealthService } from './health.service';

class HealthResponseDto {
  status!: string;
  service!: string;
}

class ReadinessResponseDto {
  status!: string;
  checks!: {
    redis: string;
  };
}

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness probe for generative service' })
  @ApiOkEntityResponse({
    type: HealthResponseDto,
    description: 'Service is alive',
  })
  @ApiStandardErrorResponses({ statuses: [500] })
  getHealth() {
    return this.healthService.getHealth();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe including Redis connectivity' })
  @ApiOkEntityResponse({
    type: ReadinessResponseDto,
    description: 'Service readiness result',
  })
  @ApiStandardErrorResponses({ statuses: [500, 503] })
  async getReadiness() {
    return this.healthService.getReadiness();
  }
}
