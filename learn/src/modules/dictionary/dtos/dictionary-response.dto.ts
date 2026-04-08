import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DictionarySentenceAudioDto {
  @ApiProperty({ example: 'Hello, how are you?' })
  key!: string;

  @ApiPropertyOptional({ example: 'Xin chao, ban khoe khong?', nullable: true })
  trans?: string | null;

  @ApiPropertyOptional({
    example: 'https://audio.example.com/hello.mp3',
    nullable: true,
  })
  audio?: string | null;
}

export class DictionaryWordDetailDto {
  @ApiPropertyOptional({ example: 'Xin chao' })
  trans?: string | null;

  @ApiPropertyOptional({ example: 'used as a greeting' })
  definition?: string | null;

  @ApiPropertyOptional({ example: 'used as a greeting' })
  definitionGpt?: string | null;

  @ApiPropertyOptional({ example: 'A1' })
  cefrLevel?: string | null;

  @ApiProperty({ type: [DictionarySentenceAudioDto] })
  sentenceAudio!: DictionarySentenceAudioDto[];
}

export class DictionaryEntryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'hello' })
  content!: string;

  @ApiPropertyOptional({ example: 'interjection' })
  position?: string | null;

  @ApiPropertyOptional({ example: '/həˈloʊ/' })
  phoneticUs?: string | null;

  @ApiPropertyOptional({ example: '/həˈləʊ/' })
  phoneticUk?: string | null;

  @ApiPropertyOptional({ example: 'https://audio.example.com/us.mp3' })
  audioUs?: string | null;

  @ApiPropertyOptional({ example: 'https://audio.example.com/uk.mp3' })
  audioUk?: string | null;

  @ApiProperty({ type: [DictionaryWordDetailDto] })
  words!: DictionaryWordDetailDto[];
}

export class DictionaryIeltsItemDto {
  @ApiProperty({ example: 'IELTS Practice Test Cambridge 10 Reading Test 04' })
  name!: string;

  @ApiProperty({ example: 'The megafires of California' })
  title!: string;

  @ApiProperty({ example: 'Drought, housing expansion...' })
  content!: string;
}

export class DictionarySearchResponseDto {
  @ApiProperty({ type: [DictionaryEntryDto] })
  data!: DictionaryEntryDto[];

  @ApiPropertyOptional({ type: [DictionaryIeltsItemDto] })
  dataIelts?: DictionaryIeltsItemDto[];

  @ApiProperty({ example: 200 })
  code!: number;

  @ApiPropertyOptional({ example: 'success' })
  msg?: string;
}
