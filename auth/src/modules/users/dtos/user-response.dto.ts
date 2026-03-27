import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: '63d27eca-fb7a-4035-ad5d-ad6df31b20c2' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'John Doe', nullable: true })
  name?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  avatar?: string | null;

  @ApiProperty({ example: 'USER' })
  role!: string;

  @ApiProperty({ example: '2026-03-27T14:22:31.123Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-27T14:22:31.123Z' })
  updatedAt!: string;

  @ApiPropertyOptional({ example: '2026-03-27T14:22:31.123Z', nullable: true })
  lastLoginAt?: string | null;
}
