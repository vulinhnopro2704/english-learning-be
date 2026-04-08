import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  ApiCreatedEntityResponse,
  ApiCursorPaginatedResponse,
  ApiMessageResponse,
  ApiOkEntityResponse,
  ApiStandardErrorResponses,
} from '@english-learning/nest-api-docs';
import { WordsService } from './words.service';
import { CreateWordDto } from './dtos/create-word.dto';
import { UpdateWordDto } from './dtos/update-word.dto';
import { WordFilterDto } from './dtos/word-filter.dto';
import { WordResponseDto } from './dtos/word-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@ApiTags('words')
@ApiBearerAuth()
@Controller('words')
@UseGuards(JwtAuthGuard)
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Get()
  @ApiOperation({ summary: 'List words with optional filters' })
  @ApiCursorPaginatedResponse({
    description: 'Paginated list of words',
    itemType: WordResponseDto,
    includeTotal: true,
  })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500] })
  findAll(
    @Query() filter: WordFilterDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.wordsService.findAll(filter, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single word by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkEntityResponse({ type: WordResponseDto, description: 'Word found' })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.wordsService.findOne(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new word' })
  @ApiCreatedEntityResponse({
    type: WordResponseDto,
    description: 'Word created',
  })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500] })
  create(@Body() dto: CreateWordDto, @CurrentUser() user: CurrentUserPayload) {
    return this.wordsService.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a word by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkEntityResponse({
    type: WordResponseDto,
    description: 'Word updated',
  })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWordDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.wordsService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a word by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiMessageResponse('Word deleted')
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.wordsService.remove(id, user);
  }
}
