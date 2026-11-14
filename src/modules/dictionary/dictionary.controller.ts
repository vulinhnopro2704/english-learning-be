import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetCurrentUser } from '../../common/decorators/current-user.decorator';
import { DictionaryService } from './dictionary.service';
import { DictionarySearchDto } from './dtos/dictionary-search.dto';
import { DictionarySearchResponseDto } from './dtos/dictionary-response.dto';

@ApiTags('Dictionary')
@ApiBearerAuth()
@Controller('dictionary')
export class DictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search dictionary from Mochi service' })
  @ApiResponse({
    status: 200,
    description: 'Dictionary search result',
    type: DictionarySearchResponseDto,
  })
  search(
    @Query() query: DictionarySearchDto,
    @GetCurrentUser('id') userId: string,
  ) {
    return this.dictionaryService.search(query, userId);
  }
}
