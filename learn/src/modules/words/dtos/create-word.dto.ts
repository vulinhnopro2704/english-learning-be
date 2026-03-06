import { IsString, MaxLength, IsOptional, IsInt } from 'class-validator';

export class CreateWordDto {
  @IsString()
  @MaxLength(255)
  word!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  pronunciation?: string;

  @IsString()
  meaning!: string;

  @IsOptional()
  @IsString()
  example?: string;

  @IsOptional()
  @IsString()
  exampleVi?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  audio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  pos?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  cefr?: string;

  @IsOptional()
  @IsInt()
  lessonId?: number;
}
