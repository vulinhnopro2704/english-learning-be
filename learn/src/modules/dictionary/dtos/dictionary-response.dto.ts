import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DictionaryPhonemeDto {
  @ApiProperty({ example: '/l/' })
  character!: string;

  @ApiPropertyOptional({ example: 'https://audio.example.com/phoneme.mp3' })
  characterAudio?: string | null;

  @ApiProperty({ example: 'look /luk/' })
  phonemes!: string;

  @ApiPropertyOptional({ example: 'https://audio.example.com/word.mp3' })
  phonemesAudio?: string | null;
}

export class DictionaryAnalyzingDto {
  @ApiProperty({ example: 'single word' })
  typeWord!: string;

  @ApiProperty({ example: 3 })
  countPhoneme!: number;

  @ApiProperty({ type: [DictionaryPhonemeDto] })
  phonemesUs!: DictionaryPhonemeDto[];

  @ApiProperty({ type: [DictionaryPhonemeDto] })
  phonemesUk!: DictionaryPhonemeDto[];
}

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
  @ApiPropertyOptional({ example: 196334 })
  id?: number;

  @ApiPropertyOptional({ example: 34586 })
  wmId?: number;

  @ApiPropertyOptional({ example: 'Xin chao' })
  trans?: string | null;

  @ApiPropertyOptional({ example: 'used as a greeting' })
  definition?: string | null;

  @ApiPropertyOptional({ example: 'used as a greeting' })
  definitionGpt?: string | null;

  @ApiPropertyOptional({ example: 'A1' })
  cefrLevel?: string | null;

  @ApiPropertyOptional({ example: '/luk/' })
  phonetic?: string | null;

  @ApiPropertyOptional({ example: 'verb' })
  position?: string | null;

  @ApiPropertyOptional({ example: 'https://image.example.com/look.png' })
  picture?: string | null;

  @ApiPropertyOptional({ example: 'https://audio.example.com/look.mp3' })
  audio?: string | null;

  @ApiPropertyOptional({ example: 1 })
  review?: number;

  @ApiPropertyOptional({ example: '' })
  ieltsLevel?: string | null;

  @ApiPropertyOptional({ example: '' })
  toeic?: string | null;

  @ApiPropertyOptional({ example: '' })
  single?: number | string | null;

  @ApiPropertyOptional({ example: '' })
  collo?: number | string | null;

  @ApiPropertyOptional({ example: '' })
  synonym?: number | string | null;

  @ApiProperty({ type: [DictionarySentenceAudioDto] })
  sentenceAudio!: DictionarySentenceAudioDto[];

  @ApiProperty({ type: [Object] })
  collocations!: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ type: Object, nullable: true })
  synonyms?: Record<string, unknown> | null;

  @ApiProperty({ example: false })
  isSaved!: boolean;
}

export class DictionaryPhrasalVerbDto {
  @ApiProperty({ example: 928 })
  id!: number;

  @ApiProperty({ example: 34588 })
  wmId!: number;

  @ApiProperty({ example: 'look after' })
  phrasalVerbs!: string;

  @ApiPropertyOptional({ example: '/luk afta/' })
  phoneticUk?: string | null;

  @ApiPropertyOptional({ example: '/luk after/' })
  phoneticUs?: string | null;

  @ApiPropertyOptional({ example: 'look_after_uk.mp3' })
  audioUk?: string | null;

  @ApiPropertyOptional({ example: 'look_after_us.mp3' })
  audioUs?: string | null;
}

export class DictionaryIdiomTranslationDto {
  @ApiProperty({ example: 1408 })
  id!: number;

  @ApiProperty({ example: 1415 })
  idiomId!: number;

  @ApiProperty({ example: 'Nhin cham cham vao dieu gi do' })
  idiom!: string;

  @ApiPropertyOptional({ example: 'Dinh nghia' })
  definition?: string | null;

  @ApiPropertyOptional({ example: 'Vi du 1' })
  example?: string | null;

  @ApiPropertyOptional({ example: 'Vi du 2' })
  example2?: string | null;
}

export class DictionaryPivotDto {
  @ApiProperty({ example: 34587 })
  wmId!: number;

  @ApiProperty({ example: 1415 })
  idiomId!: number;
}

export class DictionaryIdiomDto {
  @ApiProperty({ example: 1415 })
  id!: number;

  @ApiProperty({ example: 34587 })
  wmId!: number;

  @ApiProperty({ example: 'take a long look at something' })
  idiom!: string;

  @ApiPropertyOptional({ example: 'https://audio.example.com/idiom.mp3' })
  audio?: string | null;

  @ApiPropertyOptional({ example: 'Definition' })
  definition?: string | null;

  @ApiPropertyOptional({ example: 'Definition gpt' })
  definitionGpt?: string | null;

  @ApiPropertyOptional({ example: 'Example' })
  example?: string | null;

  @ApiPropertyOptional({ example: 'https://audio.example.com/example.mp3' })
  idiomsExAudio?: string | null;

  @ApiPropertyOptional({ example: 'Example 2' })
  example2?: string | null;

  @ApiPropertyOptional({ example: 'stressed' })
  stressed?: string | null;

  @ApiPropertyOptional({ example: 'reason' })
  reason?: string | null;

  @ApiPropertyOptional({ type: DictionaryIdiomTranslationDto, nullable: true })
  idiomsTran?: DictionaryIdiomTranslationDto | null;

  @ApiProperty({ type: DictionaryPivotDto })
  pivot!: DictionaryPivotDto;
}

export class DictionaryVerbFormDto {
  @ApiProperty({ example: 2965 })
  id!: number;

  @ApiProperty({ example: 34588 })
  wmId!: number;

  @ApiPropertyOptional({ example: 'look' })
  presentSimple?: string | null;

  @ApiPropertyOptional({ example: '/luk/' })
  presentSimplePhonetic?: string | null;

  @ApiPropertyOptional({ example: 'look_us.mp3' })
  presentSimpleAudioUs?: string | null;

  @ApiPropertyOptional({ example: 'look_uk.mp3' })
  presentSimpleAudioUk?: string | null;

  @ApiPropertyOptional({ example: 'looks' })
  singularVerb?: string | null;

  @ApiPropertyOptional({ example: '/luks/' })
  singularVerbPhonetic?: string | null;

  @ApiPropertyOptional({ example: 'looks_us.mp3' })
  singularVerbAudioUs?: string | null;

  @ApiPropertyOptional({ example: 'looks_uk.mp3' })
  singularVerbAudioUk?: string | null;

  @ApiPropertyOptional({ example: 'looked' })
  pastSimple?: string | null;

  @ApiPropertyOptional({ example: '/lukt/' })
  pastSimplePhonetic?: string | null;

  @ApiPropertyOptional({ example: 'looked_us.mp3' })
  pastSimpleAudioUs?: string | null;

  @ApiPropertyOptional({ example: 'looked_uk.mp3' })
  pastSimpleAudioUk?: string | null;

  @ApiPropertyOptional({ example: 'looked' })
  pastParticiple?: string | null;

  @ApiPropertyOptional({ example: '/lukt/' })
  pastParticiplePhonetic?: string | null;

  @ApiPropertyOptional({ example: 'looked_us.mp3' })
  pastParticipleAudioUs?: string | null;

  @ApiPropertyOptional({ example: 'looked_uk.mp3' })
  pastParticipleAudioUk?: string | null;

  @ApiPropertyOptional({ example: 'looking' })
  ingForm?: string | null;

  @ApiPropertyOptional({ example: '/luking/' })
  ingFormPhonetic?: string | null;

  @ApiPropertyOptional({ example: 'looking_us.mp3' })
  ingFormAudioUs?: string | null;

  @ApiPropertyOptional({ example: 'looking_uk.mp3' })
  ingFormAudioUk?: string | null;
}

export class DictionaryThesaurusItemDto {
  @ApiProperty({ example: 36272 })
  id!: number;

  @ApiProperty({ example: 34586 })
  wmId!: number;

  @ApiProperty({ example: 'noun' })
  position!: string;

  @ApiProperty({ example: 'visual examination' })
  positionContent!: string;

  @ApiPropertyOptional({ example: 'attention,eye,glance' })
  strongestMatch?: string;

  @ApiPropertyOptional({ example: 'beholding,case,cast' })
  strongMatch?: string;

  @ApiPropertyOptional({ example: 'evil,eye,keeping,watch' })
  weakMatch?: string;

  @ApiPropertyOptional({ example: 'forget,ignore,neglect,overlook' })
  strongestOpposite?: string;

  @ApiPropertyOptional({ example: 'disregard,ignorance,indifference' })
  strongOpposite?: string;

  @ApiPropertyOptional({ example: 'avoid,dodge,miss' })
  weakOpposite?: string;

  @ApiPropertyOptional({ example: '2024-10-04T09:43:02.000000Z' })
  createdAt?: string | null;

  @ApiPropertyOptional({ example: '2024-10-04T09:43:02.000000Z' })
  updatedAt?: string | null;
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

  @ApiPropertyOptional({ type: DictionaryAnalyzingDto, nullable: true })
  analyzing?: DictionaryAnalyzingDto | null;

  @ApiProperty({ type: [DictionaryPhrasalVerbDto] })
  phrasalVerbs!: DictionaryPhrasalVerbDto[];

  @ApiProperty({ type: [DictionaryIdiomDto] })
  idioms!: DictionaryIdiomDto[];

  @ApiPropertyOptional({ type: DictionaryVerbFormDto, nullable: true })
  verbForm?: DictionaryVerbFormDto | null;

  @ApiProperty({ type: [DictionaryThesaurusItemDto] })
  thesaurus!: DictionaryThesaurusItemDto[];

  @ApiProperty({ example: false })
  isSaved!: boolean;

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
