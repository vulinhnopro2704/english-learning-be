import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ListeningService } from './listening.service';
import {
  ExtractTranscriptDto,
  ProcessVideoDto,
  UpdateListeningLessonDto,
  LessonFilterDto,
} from './dtos';

@ApiTags('Listening')
@ApiBearerAuth()
@Controller('listening')
export class ListeningController {
  constructor(private readonly listeningService: ListeningService) {}

  @Post('extract-transcript')
  @ApiOperation({ summary: 'Extract timestamped transcript from YouTube video' })
  async extractTranscript(@Body() dto: ExtractTranscriptDto) {
    return this.listeningService.extractTranscript(dto);
  }

  @Post('process-video')
  @ApiOperation({ summary: 'Process YouTube video into a complete 3-step listening lesson' })
  async processVideo(@Body() dto: ProcessVideoDto) {
    return this.listeningService.processVideo(dto);
  }

  @Get('lessons')
  @ApiOperation({ summary: 'List all listening lessons with filtering and pagination' })
  async listLessons(@Query() filter: LessonFilterDto) {
    return this.listeningService.listLessons(filter);
  }

  @Get('lessons/:id')
  @ApiOperation({ summary: 'Get full details of a listening lesson by ID' })
  @ApiParam({ name: 'id', description: 'Lesson identifier' })
  async getLesson(@Param('id') id: string) {
    return this.listeningService.getLesson(id);
  }

  @Get('lessons/:id/vocabularies')
  @ApiOperation({ summary: 'Get Step 1 key vocabularies for a lesson' })
  @ApiParam({ name: 'id', description: 'Lesson identifier' })
  async getLessonVocabularies(@Param('id') id: string) {
    return this.listeningService.getLessonVocabularies(id);
  }

  @Get('lessons/:id/quizzes')
  @ApiOperation({ summary: 'Get Step 2 comprehension quizzes for a lesson' })
  @ApiParam({ name: 'id', description: 'Lesson identifier' })
  async getLessonQuizzes(@Param('id') id: string) {
    return this.listeningService.getLessonQuizzes(id);
  }

  @Get('lessons/:id/segments')
  @ApiOperation({ summary: 'Get Step 3 cloze sentence segments for a lesson' })
  @ApiParam({ name: 'id', description: 'Lesson identifier' })
  async getLessonSegments(@Param('id') id: string) {
    return this.listeningService.getLessonSegments(id);
  }

  @Patch('lessons/:id')
  @ApiOperation({ summary: 'Update metadata of a listening lesson' })
  @ApiParam({ name: 'id', description: 'Lesson identifier' })
  async updateLesson(
    @Param('id') id: string,
    @Body() dto: UpdateListeningLessonDto,
  ) {
    return this.listeningService.updateLesson(id, dto);
  }

  @Delete('lessons/:id')
  @ApiOperation({ summary: 'Delete a listening lesson' })
  @ApiParam({ name: 'id', description: 'Lesson identifier' })
  async deleteLesson(@Param('id') id: string) {
    return this.listeningService.deleteLesson(id);
  }
}
