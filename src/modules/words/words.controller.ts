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
  ApiResponse,
} from '@nestjs/swagger';
import { WordsService } from './words.service';
import { CreateWordDto } from './dtos/create-word.dto';
import { UpdateWordDto } from './dtos/update-word.dto';
import { WordFilterDto } from './dtos/word-filter.dto';
import { GetCurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUser } from '../../common/types/api.types';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Words')
@ApiBearerAuth()
@Controller('words')
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Get()
  @ApiOperation({ summary: 'List words with optional filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of words' })
  findAll(
    @Query() filter: WordFilterDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.wordsService.findAll(filter, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single word by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Word found' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.wordsService.findOne(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CONTENT_CREATOR')
  @ApiOperation({ summary: 'Create a new word' })
  @ApiResponse({ status: 201, description: 'Word created successfully' })
  create(@Body() dto: CreateWordDto, @GetCurrentUser() user: CurrentUser) {
    return this.wordsService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CONTENT_CREATOR')
  @ApiOperation({ summary: 'Update a word by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Word updated successfully' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWordDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.wordsService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CONTENT_CREATOR')
  @ApiOperation({ summary: 'Delete a word by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Word deleted successfully' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.wordsService.remove(id, user);
  }
}
