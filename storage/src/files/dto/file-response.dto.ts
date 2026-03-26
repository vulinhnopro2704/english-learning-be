import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadSignatureResponseDto {
  @ApiProperty()
  signature!: string;

  @ApiProperty({ example: 1774501200 })
  timestamp!: number;

  @ApiProperty()
  apiKey!: string;

  @ApiProperty()
  cloudName!: string;

  @ApiProperty()
  folder!: string;

  @ApiProperty({ enum: ['image', 'video', 'raw'] })
  resourceType!: 'image' | 'video' | 'raw';

  @ApiProperty({ example: '2026-03-26T10:05:00.000Z' })
  expiresAt!: string;
}

export class FileResponseDto {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  id!: string;

  @ApiProperty({ example: 'users/avatars/file_123' })
  publicId!: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/demo/image/upload/v1/file_123.png' })
  secureUrl!: string;

  @ApiProperty({ enum: ['IMAGE', 'VIDEO', 'FILE'] })
  type!: string;

  @ApiPropertyOptional({ example: 'png' })
  format?: string | null;

  @ApiProperty({ example: 245123 })
  size!: number;

  @ApiProperty({ example: '63d27eca-fb7a-4035-ad5d-ad6df31b20c2' })
  ownerId!: string;

  @ApiPropertyOptional({ example: { source: 'profile' } })
  metadata?: unknown;

  @ApiProperty({ example: '2026-03-26T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-26T10:00:00.000Z' })
  updatedAt!: string;
}

export class DownloadUrlResponseDto {
  @ApiProperty({ example: 'https://api.cloudinary.com/v1_1/demo/download?...' })
  url!: string;

  @ApiProperty({ example: '2026-03-26T10:10:00.000Z' })
  expiresAt!: string;
}

export class FileListResponseDto {
  @ApiProperty({ type: [FileResponseDto] })
  data!: FileResponseDto[];

  @ApiProperty({
    example: {
      nextCursor: '11111111-1111-4111-8111-111111111111',
      hasMore: true,
      limit: 20,
    },
  })
  pagination!: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}
