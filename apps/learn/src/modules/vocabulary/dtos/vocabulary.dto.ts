import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class UpsertVocabularyNoteDto {
  @IsInt()
  wordId!: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @IsOptional()
  @IsString()
  customExample?: string;
}

export class UpdateVocabularyNoteDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @IsOptional()
  @IsString()
  customExample?: string;
}
