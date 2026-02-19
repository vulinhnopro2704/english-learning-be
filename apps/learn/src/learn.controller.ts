import { Controller } from '@nestjs/common';
import { LearnService } from './learn.service.js';

@Controller('learn')
export class LearnController {
  constructor(private readonly learnService: LearnService) {}
}
