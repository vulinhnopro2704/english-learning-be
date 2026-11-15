import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FsrsSchedulerService } from './services/fsrs-scheduler.service';
import { FsrsOptimizerService } from './services/fsrs-optimizer.service';
import {
  ReviewRequestDto,
  BulkReviewRequestDto,
  InitCardsDto,
  DueCardsFilterDto,
  RollbackModelDto,
} from './dtos';
import { GetCurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('FSRS')
@ApiBearerAuth()
@Controller('fsrs')
export class FsrsController {
  constructor(
    private readonly schedulerService: FsrsSchedulerService,
    private readonly optimizerService: FsrsOptimizerService,
  ) {}

  @Get('due')
  @ApiOperation({ summary: 'Get due word IDs for spaced repetition review' })
  async getDueCards(
    @GetCurrentUser('id') authUserId: string,
    @Query() filter: DueCardsFilterDto,
  ) {
    const userId = filter.userId || authUserId;
    const limit = filter.limit ?? 20;
    const result = await this.schedulerService.getDueCards(userId, limit);
    return {
      word_ids: result.wordIds,
      total: result.total,
    };
  }

  @Post('review')
  @ApiOperation({ summary: 'Submit single card review with auto-grading' })
  async reviewCard(
    @GetCurrentUser('id') authUserId: string,
    @Body() dto: ReviewRequestDto,
  ) {
    if (!dto.userId) dto.userId = authUserId;
    const card = await this.schedulerService.reviewCard(dto);
    return { card };
  }

  @Post('review/bulk')
  @ApiOperation({ summary: 'Submit bulk reviews from a completed practice session' })
  async reviewBulk(
    @GetCurrentUser('id') authUserId: string,
    @Body() dto: BulkReviewRequestDto,
  ) {
    if (!dto.userId) dto.userId = authUserId;
    return this.schedulerService.reviewBulk(dto);
  }

  @Post('init-cards')
  @ApiOperation({ summary: 'Initialize flashcards for newly completed lesson' })
  async initCards(
    @GetCurrentUser('id') authUserId: string,
    @Body() dto: InitCardsDto,
  ) {
    const userId = dto.userId || authUserId;
    return this.schedulerService.initCards(userId, dto.wordIds);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get summary counts of cards by memory state' })
  async getStats(
    @GetCurrentUser('id') authUserId: string,
    @Query('user_id') queryUserId?: string,
  ) {
    const userId = queryUserId || authUserId;
    return this.schedulerService.getStats(userId);
  }

  @Post('optimize')
  @ApiOperation({ summary: 'Trigger AI parameter optimization from review history' })
  async optimize(
    @GetCurrentUser('id') authUserId: string,
    @Body('user_id') bodyUserId?: string,
  ) {
    const userId = bodyUserId || authUserId;
    return this.optimizerService.optimizeParameters(userId);
  }

  @Post('optimize/rollback')
  @ApiOperation({ summary: 'Rollback FSRS parameters to previous version' })
  async rollback(
    @GetCurrentUser('id') authUserId: string,
    @Body() dto: RollbackModelDto,
  ) {
    const userId = dto.userId || authUserId;
    return this.optimizerService.rollbackModel(userId, dto.targetVersion);
  }
}
