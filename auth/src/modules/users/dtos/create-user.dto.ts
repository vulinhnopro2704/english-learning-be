import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  CONTENT_CREATOR = 'CONTENT_CREATOR',
}

export class CreateUserDto {
  /** User email address */
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  /** Password (8–72 characters) */
  @ApiProperty({ example: 'P@ssw0rd123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  /** Display name */
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  /** User role */
  @ApiPropertyOptional({ enum: UserRole, example: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
