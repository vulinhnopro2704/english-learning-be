import { Controller, Post, Get, Query, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RoleplayService } from './roleplay.service';
import { StartRoleplayDto, ChatRoleplayDto, SummarizeRoleplayDto } from './dtos/roleplay.dto';
import { CreateScenarioDto, GenerateScenarioDto } from './dtos/scenario.dto';
import { StartRoleplayResult, ChatRoleplayResult } from './roleplay.types';
import { TrustedHeadersAuthGuard } from '../../common/auth/trusted-headers-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

@ApiTags('Role-Play')
@ApiBearerAuth()
@Controller('roleplay')
export class RoleplayController {
  constructor(private readonly roleplayService: RoleplayService) {}

  @ApiOperation({ summary: 'Get available scenarios' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of public scenarios' })
  @Get('scenarios')
  async getScenarios(@Query() filters: any) {
    return this.roleplayService.getScenarios(filters);
  }

  @ApiOperation({ summary: 'Manually create a new scenario' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Scenario created successfully' })
  @Post('scenarios')
  @UseGuards(TrustedHeadersAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createScenario(
    @Body() dto: CreateScenarioDto,
    @CurrentUser('id') creatorId: string,
  ) {
    return this.roleplayService.createScenario(dto, creatorId);
  }

  @ApiOperation({ summary: 'Generate a new scenario using AI' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Scenario generated and saved successfully' })
  @Post('scenarios/generate')
  @UseGuards(TrustedHeadersAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async generateScenario(
    @Body() dto: GenerateScenarioDto,
    @CurrentUser('id') creatorId: string,
  ) {
    return this.roleplayService.generateScenario(dto, creatorId);
  }

  @ApiOperation({ summary: 'Start a role-play session' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Session started successfully' })
  @Post('start')
  @UseGuards(TrustedHeadersAuthGuard)
  @HttpCode(HttpStatus.OK)
  async startSession(
    @Body() dto: StartRoleplayDto,
    @CurrentUser('id') userId: string,
  ): Promise<StartRoleplayResult> {
    return this.roleplayService.startSession(dto, userId);
  }

  @ApiOperation({ summary: 'Chat with the AI in a role-play session' })
  @ApiResponse({ status: HttpStatus.OK, description: 'AI responded successfully' })
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() dto: ChatRoleplayDto): Promise<ChatRoleplayResult> {
    return this.roleplayService.chat(dto);
  }

  @ApiOperation({ summary: 'Generate RAG summary for a completed session' })
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Background job started' })
  @Post('summarize-for-rag')
  @HttpCode(HttpStatus.ACCEPTED)
  async summarizeForRag(@Body() dto: SummarizeRoleplayDto): Promise<{ message: string }> {
    // Fire and forget or handle asynchronously
    this.roleplayService.summarizeForRag(dto).catch(console.error);
    return { message: 'Summarization job started in the background' };
  }
}
