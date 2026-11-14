import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class UploadSignatureDto {
  @ApiProperty({ enum: ['image', 'video', 'raw'] })
  @IsIn(['image', 'video', 'raw'])
  resourceType!: 'image' | 'video' | 'raw';

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @ApiProperty({ example: 245123, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size!: number;

  @ApiProperty({ example: 'users/avatars' })
  @IsString()
  @IsNotEmpty()
  folder!: string;
}

export class DownloadUrlQueryDto {
  @ApiPropertyOptional({ minimum: 60, maximum: 3600, example: 300 })
  @ValidateIf((_, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  expiresInSeconds?: number;
}
