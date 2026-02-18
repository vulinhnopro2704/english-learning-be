import { Controller, Get } from '@nestjs/common';

@Controller('storage')
export class StorageController {
  @Get('health')
  healthCheck() {
    return 'ok';
  }
}
