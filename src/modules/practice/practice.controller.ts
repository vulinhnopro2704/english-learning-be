import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { PracticeService } from './practice.service';
import {
  SubmitFSRSPracticeDto,
  PracticeHistoryFilterDto,
  FSRSDueFilterDto,
  FSRSRiskFilterDto,
} from './dtos/practice.dto';
import { GetCurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Practice')
@ApiBearerAuth()
@Controller('practice')
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  @Post('fsrs')
  @ApiOperation({
    summary: 'Submit FSRS vocabulary review',
    description:
      'Submit batch review results from a practice session. ' +
      'Each item includes wordId, isCorrect, durationMs, and exerciseType. ' +
      'Auto-grading converts these into FSRS grade (1-4).',
  })
  @ApiResponse({ status: 201, description: 'Review processed & session saved' })
  submitFSRS(
    @GetCurrentUser('id') userId: string,
    @Body() dto: SubmitFSRSPracticeDto,
  ) {
    return this.practiceService.submitFSRS(userId, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get practice session history' })
  @ApiResponse({ status: 200, description: 'Paginated practice sessions' })
  getHistory(
    @GetCurrentUser('id') userId: string,
    @Query() filter: PracticeHistoryFilterDto,
  ) {
    return this.practiceService.getHistory(userId, filter);
  }

  @Get('fsrs/due')
  @ApiOperation({
    summary: 'Get words due for FSRS practice',
    description:
      'Fetch word IDs due for review via FSRS scheduler, then hydrate with word details.',
  })
  @ApiResponse({ status: 200, description: 'List of words due for review' })
  getDueWords(
    @GetCurrentUser('id') userId: string,
    @Query() filter: FSRSDueFilterDto,
  ) {
    return this.practiceService.getDueWords(userId, filter);
  }

  @Get('fsrs/risk')
  @ApiOperation({
    summary: 'Get high risk cards for review priority',
    description:
      'Fetch high risk cards from FSRS analytics, then hydrate with word details.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of words with high risk to forget',
  })
  getRiskCards(
    @GetCurrentUser('id') userId: string,
    @Query() filter: FSRSRiskFilterDto,
  ) {
    return this.practiceService.getRiskCards(userId, filter);
  }
}
