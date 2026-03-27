import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WordResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'hello' })
  word!: string;

  @ApiPropertyOptional({ example: '/həˈloʊ/', nullable: true })
  pronunciation?: string | null;

  @ApiProperty({ example: 'Xin chào' })
  meaning!: string;

  @ApiPropertyOptional({
    example: 'Hello, how are you?',
    nullable: true,
  })
  example?: string | null;

  @ApiPropertyOptional({
    example: 'Xin chào, bạn khỏe không?',
    nullable: true,
  })
  exampleVi?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/hello.jpg',
    nullable: true,
  })
  image?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/hello.mp3',
    nullable: true,
  })
  audio?: string | null;

  @ApiPropertyOptional({ example: 'interjection', nullable: true })
  pos?: string | null;

  @ApiPropertyOptional({ example: 'A1', nullable: true })
  cefr?: string | null;

  @ApiPropertyOptional({ example: 1, nullable: true })
  lessonId?: number | null;

  @ApiProperty({ example: '2026-03-27T14:22:31.123Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-27T14:22:31.123Z' })
  updatedAt!: string;
}
