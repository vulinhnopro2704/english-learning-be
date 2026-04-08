import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class DictionarySearchDto {
  @ApiProperty({ example: 'hello' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  word!: string;

  @ApiPropertyOptional({ example: 'vi', default: 'vi' })
  @IsOptional()
  @IsString()
  language?: string = 'vi';

  @ApiPropertyOptional({ example: 'web', default: 'web' })
  @IsOptional()
  @IsString()
  type?: string = 'web';

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'number' ? value : Number.parseInt(value as string, 10),
  )
  @IsInt()
  @Min(0)
  definition?: number = 0;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'number' ? value : Number.parseInt(value as string, 10),
  )
  @IsInt()
  @Min(0)
  searchIelts?: number = 1;
}
