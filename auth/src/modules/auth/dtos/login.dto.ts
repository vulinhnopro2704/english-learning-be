import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  /** User email address */
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  /** Account password */
  @ApiProperty({ example: 'P@ssw0rd123' })
  @IsString()
  password!: string;
}
