import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CompleteLessonDto {
  @ApiPropertyOptional({
    example: 0.25,
    description:
      'Completion score. Preferred: wrongWords/totalWords ratio (0..1). Legacy 0..100 values are also accepted.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(100)
  score?: number = 0;
}
