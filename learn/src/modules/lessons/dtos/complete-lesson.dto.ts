import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CompleteLessonDto {
  @ApiPropertyOptional({ example: 80, description: 'Score (0-100)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number = 0;
}
