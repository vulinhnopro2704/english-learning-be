import {
  IsString,
  MaxLength,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
} from 'class-validator';

export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  image?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsInt()
  courseId?: number;
}
