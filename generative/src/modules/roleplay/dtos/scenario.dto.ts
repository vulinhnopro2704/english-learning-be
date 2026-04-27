import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScenarioDto {
  @ApiProperty({ example: 'Job Interview', description: 'Title of the scenario' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'You are applying for a software engineer role', description: 'Context of the scenario' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'A strict hiring manager', description: 'Persona of the AI' })
  @IsString()
  @IsNotEmpty()
  aiPersona: string;

  @ApiProperty({ example: 'A confident candidate', description: 'Persona of the user' })
  @IsString()
  @IsNotEmpty()
  userPersona: string;

  @ApiProperty({
    example: ['Introduce yourself', 'Explain your experience', 'Ask a question'],
    description: 'List of 3 tasks the user must complete',
  })
  @IsArray()
  requiredTasks: string[];

  @ApiPropertyOptional({ example: 'B1', description: 'Target CEFR level' })
  @IsString()
  @IsOptional()
  level?: string;

  @ApiPropertyOptional({ example: 'Business', description: 'Topic or category' })
  @IsString()
  @IsOptional()
  topic?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the scenario is available to all users' })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

export class GenerateScenarioDto {
  @ApiProperty({ example: 'Ordering coffee at a busy cafe', description: 'Desired topic or context' })
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiProperty({ example: 'A2', description: 'Target CEFR level for the generated scenario' })
  @IsString()
  @IsNotEmpty()
  level: string;

  @ApiPropertyOptional({ example: true, description: 'Whether to make the generated scenario public' })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
