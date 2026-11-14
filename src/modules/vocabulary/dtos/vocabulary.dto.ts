import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertVocabularyNoteDto {
  /** Word ID to attach note to */
  @ApiProperty({ example: 42 })
  @IsInt()
  wordId!: number;

  /** Personal note about the word */
  @ApiPropertyOptional({ example: 'Remember: used for formal greetings' })
  @IsOptional()
  @IsString()
  note?: string;

  /** Mark as favorite */
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  /** Custom example sentence */
  @ApiPropertyOptional({ example: 'I greeted him warmly at the party.' })
  @IsOptional()
  @IsString()
  customExample?: string;
}

export class UpdateVocabularyNoteDto {
  /** Personal note about the word */
  @ApiPropertyOptional({ example: 'Updated note content' })
  @IsOptional()
  @IsString()
  note?: string;

  /** Mark as favorite */
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  /** Custom example sentence */
  @ApiPropertyOptional({ example: 'She said hello to everyone.' })
  @IsOptional()
  @IsString()
  customExample?: string;
}
