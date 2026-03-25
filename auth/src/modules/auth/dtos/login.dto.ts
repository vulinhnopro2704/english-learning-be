import { IsDefined, IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  /** User email address */
  @ApiProperty({ example: 'user@example.com' })
  @IsDefined({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email!: string;

  /** Account password */
  @ApiProperty({ example: 'P@ssw0rd123' })
  @IsDefined({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  password!: string;
}
