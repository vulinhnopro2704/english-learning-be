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
import { VocabularyService } from './vocabulary.service';
import {
  UpsertVocabularyNoteDto,
  UpdateVocabularyNoteDto,
} from './dtos/vocabulary.dto';
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
  getMyNotes(
    @CurrentUser('id') userId: string,
    @Query() filter: VocabularyFilterDto,
  ) {
    return this.vocabularyService.getMyNotes(userId, filter);
  }

  @Post()
  @ApiOperation({ summary: 'Create or update a vocabulary note' })
  @ApiResponse({ status: 201, description: 'Note created or updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  upsertNote(
    @CurrentUser('id') userId: string,
    @Body() dto: UpsertVocabularyNoteDto,
  ) {
    return this.vocabularyService.upsertNote(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vocabulary note by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Note updated' })
  @ApiResponse({ status: 404, description: 'Note not found' })
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
  @ApiResponse({ status: 404, description: 'Note not found' })
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
  @ApiResponse({ status: 404, description: 'Word not found' })
  toggleFavorite(
    @CurrentUser('id') userId: string,
    @Param('wordId', ParseIntPipe) wordId: number,
  ) {
    return this.vocabularyService.toggleFavorite(userId, wordId);
  }
}
