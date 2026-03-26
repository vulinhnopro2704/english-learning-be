import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export class CreateFileDto {
  @ApiProperty({ example: 'users/avatars/file_123' })
  @IsString()
  @IsNotEmpty()
  publicId!: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/demo/image/upload/v1/file_123.png' })
  @IsUrl({ require_tld: false })
  secureUrl!: string;

  @ApiProperty({ enum: ['image', 'video', 'file'] })
  @IsIn(['image', 'video', 'file'])
  type!: 'image' | 'video' | 'file';

  @ApiPropertyOptional({ example: 'png' })
  @IsOptional()
  @IsString()
  format?: string;

  @ApiProperty({ example: 245123, minimum: 1, maximum: 209715200 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200 * 1024 * 1024)
  size!: number;

  @ApiPropertyOptional({ example: { source: 'profile' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
