import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class SegmentInputDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  id?: number;

  @ApiProperty({ example: 0.0 })
  @IsNumber()
  start!: number;

  @ApiProperty({ example: 4.5 })
  @IsNumber()
  end!: number;

  @ApiPropertyOptional({ example: 4.5 })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiProperty({ example: 'Consistency is crucial when building new habits.' })
  @IsString()
  text!: string;
}

export class GenerateListeningContentDto {
  @ApiPropertyOptional({
    description: 'Full plain text transcript of the video',
    example: 'Consistency is crucial when building new habits...',
  })
  @IsOptional()
  @IsString()
  transcript?: string;

  @ApiProperty({
    type: [SegmentInputDto],
    description: 'Timestamped subtitle segments from YouTube',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SegmentInputDto)
  segments!: SegmentInputDto[];

  @ApiPropertyOptional({
    example: 'medium',
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ example: 'Building atomic habits daily' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: 12,
    default: 12,
    description: 'Desired vocabulary count (10 to 15)',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(25)
  targetVocabCount?: number;

  @ApiPropertyOptional({
    example: 4,
    default: 4,
    description: 'Desired quiz count (3 to 6)',
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(8)
  targetQuizCount?: number;
}

export class ExtractVocabDto {
  @ApiProperty({
    type: [SegmentInputDto],
    description: 'Timestamped subtitle segments',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SegmentInputDto)
  segments!: SegmentInputDto[];

  @ApiPropertyOptional({ example: 'medium', default: 'medium' })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ example: 12, default: 12 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(25)
  targetVocabCount?: number;
}

export class GenerateQuizzesDto {
  @ApiProperty({
    type: [SegmentInputDto],
    description: 'Timestamped subtitle segments',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SegmentInputDto)
  segments!: SegmentInputDto[];

  @ApiPropertyOptional({ example: 'medium', default: 'medium' })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ example: 4, default: 4 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(8)
  targetQuizCount?: number;
}

export class GeneratedVocabularyItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'consistency' })
  word!: string;

  @ApiPropertyOptional({ example: 'n' })
  partOfSpeech?: string;

  @ApiPropertyOptional({ example: '/kənˈsɪstənsi/' })
  phonetic?: string;

  @ApiProperty({ example: 'Tính nhất quán, sự kiên định' })
  meaningVi!: string;

  @ApiPropertyOptional({
    example: 'Consistency is crucial when building new habits.',
  })
  example?: string;

  @ApiPropertyOptional({
    example: 'Sự kiên định là điều cốt yếu khi xây dựng thói quen mới.',
  })
  exampleVi?: string;

  @ApiPropertyOptional({
    example: 'https://audio.example.com/consistency.mp3',
  })
  audioUrl?: string | null;

  @ApiPropertyOptional({ example: 34586 })
  externalDictionaryId?: number | null;
}

export class GeneratedQuizQuestionDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({
    example: 'What is the main factor mentioned for habit formation?',
  })
  question!: string;

  @ApiProperty({
    type: [String],
    example: [
      'Daily consistency and repetition',
      'Occasional intense effort',
      'Waiting for perfect inspiration',
      'Avoiding difficult tasks',
    ],
  })
  options!: string[];

  @ApiProperty({ example: 0 })
  correctAnswerIndex!: number;

  @ApiPropertyOptional({
    example:
      'The speaker stresses that small daily repetitions form strong neural pathways.',
  })
  explanation?: string;

  @ApiPropertyOptional({ example: 45.5 })
  segmentTimestamp?: number;

  @ApiPropertyOptional({ example: 42.0 })
  startTime?: number;

  @ApiPropertyOptional({ example: 58.5 })
  endTime?: number;
}

export class GeneratedListeningLessonResponseDto {
  @ApiProperty({ type: [GeneratedVocabularyItemDto] })
  vocabularyList!: GeneratedVocabularyItemDto[];

  @ApiProperty({ type: [GeneratedQuizQuestionDto] })
  quizQuestions!: GeneratedQuizQuestionDto[];
}
