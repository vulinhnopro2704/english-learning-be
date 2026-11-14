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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { VocabularyService } from './vocabulary.service';
import {
  UpsertVocabularyNoteDto,
  UpdateVocabularyNoteDto,
} from './dtos/vocabulary.dto';
import { CreateVocabularyFromDictionaryDto } from './dtos/create-vocabulary-from-dictionary.dto';
import { VocabularyFilterDto } from './dtos/vocabulary-filter.dto';
import { GetCurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Vocabulary')
@ApiBearerAuth()
@Controller('vocabulary')
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user vocabulary notes' })
  @ApiResponse({ status: 200, description: 'List of vocabulary notes' })
  getMyNotes(
    @GetCurrentUser('id') userId: string,
    @Query() filter: VocabularyFilterDto,
  ) {
    return this.vocabularyService.getMyNotes(userId, filter);
  }

  @Post()
  @ApiOperation({ summary: 'Create or update a vocabulary note' })
  @ApiResponse({ status: 201, description: 'Note created or updated' })
  upsertNote(
    @GetCurrentUser('id') userId: string,
    @Body() dto: UpsertVocabularyNoteDto,
  ) {
    return this.vocabularyService.upsertNote(userId, dto);
  }

  @Post('from-dictionary')
  @ApiOperation({
    summary: 'Create or update vocabulary note from dictionary payload',
  })
  @ApiResponse({
    status: 201,
    description: 'Dictionary word saved to notebook',
  })
  createFromDictionary(
    @GetCurrentUser('id') userId: string,
    @Body() dto: CreateVocabularyFromDictionaryDto,
  ) {
    return this.vocabularyService.createFromDictionary(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vocabulary note by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Note updated' })
  updateNote(
    @GetCurrentUser('id') userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVocabularyNoteDto,
  ) {
    return this.vocabularyService.updateNote(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a vocabulary note by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Note removed' })
  removeNote(
    @GetCurrentUser('id') userId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vocabularyService.removeNote(userId, id);
  }

  @Post('words/:wordId/favorite')
  @ApiOperation({ summary: 'Toggle favorite status for a word' })
  @ApiParam({ name: 'wordId', type: Number })
  @ApiResponse({ status: 201, description: 'Favorite status toggled' })
  toggleFavorite(
    @GetCurrentUser('id') userId: string,
    @Param('wordId', ParseIntPipe) wordId: number,
  ) {
    return this.vocabularyService.toggleFavorite(userId, wordId);
  }
}
