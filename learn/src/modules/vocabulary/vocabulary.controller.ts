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
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '@english-learning/nest-api-docs';
import { VocabularyService } from './vocabulary.service';
import {
  UpsertVocabularyNoteDto,
  UpdateVocabularyNoteDto,
} from './dtos/vocabulary.dto';
import { CreateVocabularyFromDictionaryDto } from './dtos/create-vocabulary-from-dictionary.dto';
import { VocabularyFilterDto } from './dtos/vocabulary-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('vocabulary')
@ApiBearerAuth()
@Controller('vocabulary')
@UseGuards(JwtAuthGuard)
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  @Get()
  @ApiOperation({ summary: 'Get user vocabulary notes' })
  @ApiResponse({ status: 200, description: 'List of vocabulary notes' })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500] })
  getMyNotes(
    @CurrentUser('id') userId: string,
    @Query() filter: VocabularyFilterDto,
  ) {
    return this.vocabularyService.getMyNotes(userId, filter);
  }

  @Post()
  @ApiOperation({ summary: 'Create or update a vocabulary note' })
  @ApiResponse({ status: 201, description: 'Note created or updated' })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  upsertNote(
    @CurrentUser('id') userId: string,
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
  @ApiStandardErrorResponses({ statuses: [401, 422, 500] })
  createFromDictionary(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateVocabularyFromDictionaryDto,
  ) {
    return this.vocabularyService.createFromDictionary(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vocabulary note by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Note updated' })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  updateNote(
    @CurrentUser('id') userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVocabularyNoteDto,
  ) {
    return this.vocabularyService.updateNote(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a vocabulary note by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Note removed' })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  removeNote(
    @CurrentUser('id') userId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vocabularyService.removeNote(userId, id);
  }

  @Post('words/:wordId/favorite')
  @ApiOperation({ summary: 'Toggle favorite status for a word' })
  @ApiParam({ name: 'wordId', type: Number })
  @ApiResponse({ status: 201, description: 'Favorite status toggled' })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  toggleFavorite(
    @CurrentUser('id') userId: string,
    @Param('wordId', ParseIntPipe) wordId: number,
  ) {
    return this.vocabularyService.toggleFavorite(userId, wordId);
  }
}
