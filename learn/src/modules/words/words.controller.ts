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
  findAll(@Query() filter: WordFilterDto) {
    return this.wordsService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single word by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkEntityResponse({ type: WordResponseDto, description: 'Word found' })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.wordsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new word' })
  @ApiCreatedEntityResponse({
    type: WordResponseDto,
    description: 'Word created',
  })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500] })
  create(@Body() dto: CreateWordDto) {
    return this.wordsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a word by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkEntityResponse({
    type: WordResponseDto,
    description: 'Word updated',
  })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWordDto) {
    return this.wordsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a word by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiMessageResponse('Word deleted')
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.wordsService.remove(id);
  }
}
