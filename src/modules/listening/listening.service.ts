import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { PrismaService } from '../../database/prisma.service';
import { ApiException } from '../../common/exceptions/api.exception';
import { YouTubeService } from './services/youtube.service';
import { BlankGeneratorService } from './services/blank-generator.service';
import {
  ExtractTranscriptDto,
  ProcessVideoDto,
  UpdateListeningLessonDto,
  LessonFilterDto,
} from './dtos';

@Injectable()
export class ListeningService {
  private readonly logger = new Logger(ListeningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly youtubeService: YouTubeService,
    private readonly blankGeneratorService: BlankGeneratorService,
  ) {}

  /**
   * Extracts YouTube transcript and returns timestamped segments.
   */
  async extractTranscript(dto: ExtractTranscriptDto) {
    return this.youtubeService.getTranscript(dto.youtubeUrl, dto.language || 'en');
  }

  /**
   * Processes a YouTube video, generates exercises, and saves to database.
   */
  async processVideo(dto: ProcessVideoDto) {
    const transcript = await this.youtubeService.getTranscript(dto.youtubeUrl, 'en');

    const lessonId = `lesson-${uuidv7().substring(0, 12)}`;
    const title = dto.title?.trim() || transcript.title;
    const description = dto.description?.trim() || `YouTube Listening Lesson for ${transcript.videoId}`;
    const difficulty = dto.difficulty || 'medium';

    // Generate Cloze blanks on segments
    const clozeSegments = this.blankGeneratorService.generateBlanks(
      transcript.segments,
      difficulty,
    );

    // Save lesson and segments in a transaction
    const lesson = await this.prisma.$transaction(async (tx) => {
      const createdLesson = await tx.listeningLesson.create({
        data: {
          id: lessonId,
          videoId: transcript.videoId,
          title,
          description,
          thumbnailUrl: transcript.thumbnailUrl,
          duration: transcript.duration,
          difficulty,
          language: transcript.language,
          isPublished: dto.isPublished ?? true,
          status: 'READY',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      for (let i = 0; i < clozeSegments.length; i++) {
        const seg = clozeSegments[i];
        const segId = `seg-${uuidv7().substring(0, 12)}`;

        const createdSegment = await tx.lessonSegment.create({
          data: {
            id: segId,
            lessonId,
            segmentIndex: i,
            startTime: seg.start,
            endTime: seg.end,
            duration: seg.duration,
            text: seg.text,
            maskedText: seg.maskedText,
            createdAt: new Date(),
          },
        });

        if (seg.blanks && seg.blanks.length > 0) {
          await tx.segmentBlank.createMany({
            data: seg.blanks.map((b) => ({
              id: `blank-${uuidv7().substring(0, 12)}`,
              segmentId: createdSegment.id,
              blankIndex: b.index,
              originalWord: b.originalWord,
              hint: b.hint,
              createdAt: new Date(),
            })),
          });
        }
      }

      return createdLesson;
    });

    this.logger.log(`Successfully created listening lesson ${lesson.id} for video ${transcript.videoId}`);
    return this.getLesson(lesson.id);
  }

  /**
   * Lists listening lessons with optional search and filters.
   */
  async listLessons(filter: LessonFilterDto) {
    const take = filter.limit ?? 20;
    const skip = filter.offset ?? 0;

    const where: any = {};
    if (filter.query) {
      where.OR = [
        { title: { contains: filter.query, mode: 'insensitive' } },
        { description: { contains: filter.query, mode: 'insensitive' } },
      ];
    }
    if (filter.difficulty) {
      where.difficulty = filter.difficulty;
    }
    if (filter.isPublished !== undefined) {
      where.isPublished = filter.isPublished;
    }

    const [items, total] = await Promise.all([
      this.prisma.listeningLesson.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              vocabularies: true,
              quizzes: true,
              segments: true,
            },
          },
        },
      }),
      this.prisma.listeningLesson.count({ where }),
    ]);

    const summaries = items.map((lesson) => ({
      id: lesson.id,
      videoId: lesson.videoId,
      title: lesson.title,
      description: lesson.description || '',
      thumbnailUrl: lesson.thumbnailUrl,
      duration: lesson.duration,
      difficulty: lesson.difficulty,
      language: lesson.language,
      isPublished: lesson.isPublished,
      status: lesson.status,
      errorMessage: lesson.errorMessage,
      totalSegments: lesson._count.segments,
      totalVocab: lesson._count.vocabularies,
      totalQuiz: lesson._count.quizzes,
      createdAt: lesson.createdAt?.toISOString(),
      updatedAt: lesson.updatedAt?.toISOString(),
    }));

    return { total, items: summaries };
  }

  /**
   * Retrieves full details of a listening lesson including vocabularies, quizzes, and cloze segments.
   */
  async getLesson(lessonId: string) {
    const lesson = await this.prisma.listeningLesson.findUnique({
      where: { id: lessonId },
      include: {
        vocabularies: { orderBy: { order: 'asc' } },
        quizzes: { orderBy: { order: 'asc' } },
        segments: {
          include: { blanks: { orderBy: { blankIndex: 'asc' } } },
          orderBy: { segmentIndex: 'asc' },
        },
      },
    });

    if (!lesson) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'LESSON_NOT_FOUND',
        message: `Listening lesson '${lessonId}' not found`,
      });
    }

    return lesson;
  }

  /**
   * Retrieves step 1 vocabulary flashcards for a lesson.
   */
  async getLessonVocabularies(lessonId: string) {
    await this.ensureLessonExists(lessonId);
    const vocabularies = await this.prisma.lessonVocabulary.findMany({
      where: { lessonId },
      orderBy: { order: 'asc' },
    });
    return {
      lessonId,
      totalVocab: vocabularies.length,
      vocabularyList: vocabularies,
    };
  }

  /**
   * Retrieves step 2 comprehension quizzes for a lesson.
   */
  async getLessonQuizzes(lessonId: string) {
    await this.ensureLessonExists(lessonId);
    const quizzes = await this.prisma.lessonQuiz.findMany({
      where: { lessonId },
      orderBy: { order: 'asc' },
    });
    return {
      lessonId,
      totalQuiz: quizzes.length,
      quizQuestions: quizzes,
    };
  }

  /**
   * Retrieves step 3 cloze sentence segments for a lesson.
   */
  async getLessonSegments(lessonId: string) {
    await this.ensureLessonExists(lessonId);
    const segments = await this.prisma.lessonSegment.findMany({
      where: { lessonId },
      include: { blanks: { orderBy: { blankIndex: 'asc' } } },
      orderBy: { segmentIndex: 'asc' },
    });
    return {
      lessonId,
      totalSegments: segments.length,
      segments,
    };
  }

  /**
   * Updates metadata of a listening lesson.
   */
  async updateLesson(lessonId: string, dto: UpdateListeningLessonDto) {
    await this.ensureLessonExists(lessonId);
    return this.prisma.listeningLesson.update({
      where: { id: lessonId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
      },
    });
  }

  /**
   * Deletes a listening lesson and cascades child segments, quizzes, and vocabularies.
   */
  async deleteLesson(lessonId: string) {
    await this.ensureLessonExists(lessonId);
    await this.prisma.listeningLesson.delete({ where: { id: lessonId } });
    return { success: true, message: `Lesson '${lessonId}' deleted successfully` };
  }

  private async ensureLessonExists(lessonId: string): Promise<void> {
    const exists = await this.prisma.listeningLesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    });
    if (!exists) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'LESSON_NOT_FOUND',
        message: `Listening lesson '${lessonId}' not found`,
      });
    }
  }
}
