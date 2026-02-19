import { Controller, Get } from '@nestjs/common';

@Controller('storage')
export class StorageController {
  @Get('hello')
  getHello(): string {
    return 'Hello, Storage!';
  }
}
