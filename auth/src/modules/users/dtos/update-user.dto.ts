import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from './create-user.dto';

export class UpdateUserDto {
  /** Updated email address */
  @ApiPropertyOptional({ example: 'new-email@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  /** Updated password (8–72 characters) */
  @ApiPropertyOptional({
    example: 'NewP@ssw0rd456',
    minLength: 8,
    maxLength: 72,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  /** Updated display name */
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  /** Avatar URL */
  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString()
  avatar?: string;

  /** User role */
  @ApiPropertyOptional({ enum: UserRole, example: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
