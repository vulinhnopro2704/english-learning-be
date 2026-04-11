import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '@english-learning/nest-api-docs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DictionaryService } from './dictionary.service';
import { DictionarySearchDto } from './dtos/dictionary-search.dto';
import { DictionarySearchResponseDto } from './dtos/dictionary-response.dto';

@ApiTags('dictionary')
@ApiBearerAuth()
@Controller('dictionary')
@UseGuards(JwtAuthGuard)
export class DictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search dictionary from Mochi service' })
  @ApiResponse({
    status: 200,
    description: 'Dictionary search result',
    type: DictionarySearchResponseDto,
  })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500, 502, 503] })
  search(
    @Query() query: DictionarySearchDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.dictionaryService.search(query, userId);
  }
}
