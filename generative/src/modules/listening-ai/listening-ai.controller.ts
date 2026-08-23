import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListeningAiService } from './listening-ai.service';
import {
  ExtractVocabDto,
  GenerateListeningContentDto,
  GenerateQuizzesDto,
  GeneratedListeningLessonResponseDto,
  GeneratedQuizQuestionDto,
  GeneratedVocabularyItemDto,
} from './dtos/listening-ai.dto';

@ApiTags('listening-ai')
@Controller('listening')
export class ListeningAiController {
  constructor(private readonly listeningAiService: ListeningAiService) {}

  @Post('generate-lesson-content')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate dynamic 3-step listening lesson content (Vocab + Quizzes) via AI pipeline',
  })
  @ApiResponse({
    status: 200,
    description: 'Generated vocabulary items and comprehension quiz questions',
    type: GeneratedListeningLessonResponseDto,
  })
  async generateLessonContent(
    @Body() dto: GenerateListeningContentDto,
  ): Promise<GeneratedListeningLessonResponseDto> {
    return this.listeningAiService.generateListeningContent(dto);
  }

  @Post('extract-vocab')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Extract 10-15 key vocabulary items from transcript enriched with Mochi Dictionary',
  })
  @ApiResponse({
    status: 200,
    description: 'Extracted and enriched vocabulary items',
    type: [GeneratedVocabularyItemDto],
  })
  async extractVocab(
    @Body() dto: ExtractVocabDto,
  ): Promise<GeneratedVocabularyItemDto[]> {
    return this.listeningAiService.extractVocabulary(
      dto.segments,
      dto.difficulty || 'medium',
      dto.targetVocabCount || 12,
    );
  }

  @Post('generate-quizzes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate 3-5 comprehension quiz questions based on transcript checkpoints',
  })
  @ApiResponse({
    status: 200,
    description: 'Generated comprehension quiz questions',
    type: [GeneratedQuizQuestionDto],
  })
  async generateQuizzes(
    @Body() dto: GenerateQuizzesDto,
  ): Promise<GeneratedQuizQuestionDto[]> {
    return this.listeningAiService.generateQuizQuestions(
      dto.segments,
      dto.difficulty || 'medium',
      dto.targetQuizCount || 4,
    );
  }
}
