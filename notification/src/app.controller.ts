import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('notification')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Notification service health endpoint' })
  @ApiOkResponse({ description: 'Notification service is reachable' })
  getHello(): string {
    return this.appService.getHello();
  }
}
