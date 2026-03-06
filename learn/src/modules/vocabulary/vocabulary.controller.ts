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
import { VocabularyService } from './vocabulary.service';
import {
  UpsertVocabularyNoteDto,
  UpdateVocabularyNoteDto,
} from './dtos/vocabulary.dto';
import { VocabularyFilterDto } from './dtos/vocabulary-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('vocabulary')
@UseGuards(JwtAuthGuard)
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  @Get()
  getMyNotes(
    @CurrentUser('id') userId: string,
    @Query() filter: VocabularyFilterDto,
  ) {
    return this.vocabularyService.getMyNotes(userId, filter);
  }

  @Post()
  upsertNote(
    @CurrentUser('id') userId: string,
    @Body() dto: UpsertVocabularyNoteDto,
  ) {
    return this.vocabularyService.upsertNote(userId, dto);
  }

  @Patch(':id')
  updateNote(
    @CurrentUser('id') userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVocabularyNoteDto,
  ) {
    return this.vocabularyService.updateNote(userId, id, dto);
  }

  @Delete(':id')
  removeNote(
    @CurrentUser('id') userId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vocabularyService.removeNote(userId, id);
  }

  @Post('words/:wordId/favorite')
  toggleFavorite(
    @CurrentUser('id') userId: string,
    @Param('wordId', ParseIntPipe) wordId: number,
  ) {
    return this.vocabularyService.toggleFavorite(userId, wordId);
  }
}
