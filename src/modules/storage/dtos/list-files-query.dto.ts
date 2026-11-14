import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListFilesQueryDto {
  @ApiPropertyOptional({
    example: '11111111-1111-4111-8111-111111111111',
    description: 'Cursor from previous page last item id',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: ['image', 'video', 'file'] })
  @IsOptional()
  @IsIn(['image', 'video', 'file'])
  type?: 'image' | 'video' | 'file';

  @ApiPropertyOptional({ example: '2026-03-20T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-03-26T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
