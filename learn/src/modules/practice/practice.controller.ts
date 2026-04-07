import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '@english-learning/nest-api-docs';
import { PracticeService } from './practice.service';
import {
  SubmitFSRSPracticeDto,
  PracticeHistoryFilterDto,
  FSRSDueFilterDto,
  FSRSRiskFilterDto,
} from './dtos/practice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('practice')
@ApiBearerAuth()
@Controller('practice')
@UseGuards(JwtAuthGuard)
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  @Post('fsrs')
  @ApiOperation({
    summary: 'Submit FSRS vocabulary review (Ôn tập)',
    description:
      'Submit batch review results from a practice session. ' +
      'Each item includes wordId, isCorrect, durationMs, and exerciseType. ' +
      'Auto-grading converts these into FSRS grade (1-4).',
  })
  @ApiResponse({ status: 201, description: 'Review processed & session saved' })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500, 502, 503] })
  submitFSRS(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitFSRSPracticeDto,
  ) {
    return this.practiceService.submitFSRS(userId, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get practice session history' })
  @ApiResponse({ status: 200, description: 'Paginated practice sessions' })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500] })
  getHistory(
    @CurrentUser('id') userId: string,
    @Query() filter: PracticeHistoryFilterDto,
  ) {
    return this.practiceService.getHistory(userId, filter);
  }

  @Get('fsrs/due')
  @ApiOperation({
    summary: 'Get words due for FSRS practice',
    description:
      'Proxy FSRS-AI /fsrs/due to fetch word IDs due for review, then hydrate with word details.',
  })
  @ApiResponse({ status: 200, description: 'List of words due for review' })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500, 502, 503] })
  getDueWords(
    @CurrentUser('id') userId: string,
    @Query() filter: FSRSDueFilterDto,
  ) {
    return this.practiceService.getDueWords(userId, filter);
  }

  @Get('fsrs/risk')
  @ApiOperation({
    summary: 'Get high risk cards for review priority',
    description:
      'Proxy FSRS-AI /fsrs/cards/risk to fetch high risk cards, then hydrate with word details.',
  })
  @ApiResponse({ status: 200, description: 'List of words with high risk to forget' })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500, 502, 503] })
  getRiskCards(
    @CurrentUser('id') userId: string,
    @Query() filter: FSRSRiskFilterDto,
  ) {
    return this.practiceService.getRiskCards(userId, filter);
  }
}
