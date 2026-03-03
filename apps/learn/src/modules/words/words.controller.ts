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
import { WordsService } from './words.service.js';
import { CreateWordDto } from './dtos/create-word.dto.js';
import { UpdateWordDto } from './dtos/update-word.dto.js';
import { WordFilterDto } from './dtos/word-filter.dto.js';

@Controller('words')
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Get()
  findAll(@Query() filter: WordFilterDto) {
    return this.wordsService.findAll(filter);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.wordsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateWordDto) {
    return this.wordsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWordDto) {
    return this.wordsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.wordsService.remove(id);
  }
}
