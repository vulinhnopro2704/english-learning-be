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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { WordsService } from './words.service';
import { CreateWordDto } from './dtos/create-word.dto';
import { UpdateWordDto } from './dtos/update-word.dto';
import { WordFilterDto } from './dtos/word-filter.dto';

@ApiTags('words')
@Controller('words')
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Get()
  @ApiOperation({ summary: 'List words with optional filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of words' })
  findAll(@Query() filter: WordFilterDto) {
    return this.wordsService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single word by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Word found' })
  @ApiResponse({ status: 404, description: 'Word not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.wordsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new word' })
  @ApiResponse({ status: 201, description: 'Word created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  create(@Body() dto: CreateWordDto) {
    return this.wordsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a word by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Word updated' })
  @ApiResponse({ status: 404, description: 'Word not found' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWordDto) {
    return this.wordsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a word by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Word deleted' })
  @ApiResponse({ status: 404, description: 'Word not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.wordsService.remove(id);
  }
}
