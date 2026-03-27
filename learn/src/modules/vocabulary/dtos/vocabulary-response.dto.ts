import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VocabularyWordDto {
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

  @ApiPropertyOptional({ example: 'interjection', nullable: true })
  pos?: string | null;

  @ApiPropertyOptional({ example: 'A1', nullable: true })
  cefr?: string | null;

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
}

export class VocabularyNoteResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '63d27eca-fb7a-4035-ad5d-ad6df31b20c2' })
  userId!: string;

  @ApiProperty({ example: 1 })
  wordId!: number;

  @ApiPropertyOptional({
    example: 'Remember: used for formal greetings',
    nullable: true,
  })
  note?: string | null;

  @ApiProperty({ example: true })
  isFavorite!: boolean;

  @ApiPropertyOptional({
    example: 'I greeted him warmly at the party.',
    nullable: true,
  })
  customExample?: string | null;

  @ApiProperty({ example: '2026-03-27T14:22:31.123Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-27T14:22:31.123Z' })
  updatedAt!: string;

  @ApiProperty({ type: VocabularyWordDto })
  word!: VocabularyWordDto;
}
