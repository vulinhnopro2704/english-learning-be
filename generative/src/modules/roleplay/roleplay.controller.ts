import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Param,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RoleplayService } from './roleplay.service';
import {
  StartRoleplayDto,
  ChatRoleplayDto,
  SummarizeRoleplayDto,
  ChatVoiceRoleplayDto,
} from './dtos/roleplay.dto';
import { CreateScenarioDto, GenerateScenarioDto } from './dtos/scenario.dto';
import {
  StartRoleplayResult,
  ChatRoleplayResult,
  ChatVoiceRoleplayResult,
} from './roleplay.types';
import { TrustedHeadersAuthGuard } from '../../common/auth/trusted-headers-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

@ApiTags('Role-Play')
@ApiBearerAuth()
@Controller('roleplay')
export class RoleplayController {
  private readonly logger = new Logger(RoleplayController.name);

  constructor(private readonly roleplayService: RoleplayService) {}

  @ApiOperation({ summary: 'Get available scenarios' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of public scenarios',
  })
  @Get('scenarios')
  async getScenarios(@Query() filters: any) {
    return this.roleplayService.getScenarios(filters);
  }

  @ApiOperation({ summary: 'Manually create a new scenario' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Scenario created successfully',
  })
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
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Scenario generated and saved successfully',
  })
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session started successfully',
  })
  @Post('start')
  @UseGuards(TrustedHeadersAuthGuard)
  @HttpCode(HttpStatus.OK)
  async startSession(
    @Body() dto: StartRoleplayDto,
    @CurrentUser() user: any,
  ): Promise<StartRoleplayResult> {
    return this.roleplayService.startSession(dto, user.id, user.email);
  }

  @ApiOperation({ summary: 'Chat with the AI in a role-play session' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI responded successfully',
  })
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() dto: ChatRoleplayDto): Promise<ChatRoleplayResult> {
    return this.roleplayService.chat(dto);
  }

  @ApiOperation({ summary: 'Chat with AI using voice in a role-play session' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI responded and voice synthesized successfully',
  })
  @Post('chat-voice')
  @HttpCode(HttpStatus.OK)
  async chatVoice(
    @Body() dto: ChatVoiceRoleplayDto,
  ): Promise<ChatVoiceRoleplayResult> {
    try {
      this.logger.log(
        `Received chat-voice request for session=${dto.sessionId}, mimeType=${dto.mimeType}, audioLength=${dto.audioBase64?.length}`,
      );
      return await this.roleplayService.chatVoice(dto);
    } catch (error) {
      this.logger.error(
        `Error occurred in chatVoice: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  @ApiOperation({ summary: 'Get role-play session history for current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session history retrieved successfully',
  })
  @Get('history')
  @UseGuards(TrustedHeadersAuthGuard)
  async getSessionHistory(@CurrentUser('id') userId: string) {
    return this.roleplayService.getSessionHistory(userId);
  }

  @ApiOperation({ summary: 'Get details of a specific role-play session' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session details retrieved successfully',
  })
  @Get('sessions/:sessionId')
  async getSessionDetails(@Param('sessionId') sessionId: string) {
    return this.roleplayService.getSessionDetails(sessionId);
  }

  @ApiOperation({ summary: 'Translate a message to Vietnamese' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Translation successful' })
  @Post('sessions/:sessionId/translate')
  @HttpCode(HttpStatus.OK)
  async translateMessage(
    @Param('sessionId') sessionId: string,
    @Body() dto: { text: string },
  ): Promise<{ translation: string }> {
    const translation = await this.roleplayService.translateMessage(
      dto.text,
    );
    return { translation };
  }

  @ApiOperation({ summary: 'Get suggested replies for the user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Suggestions generated successfully',
  })
  @Get('sessions/:sessionId/suggest-replies')
  async suggestReplies(
    @Param('sessionId') sessionId: string,
  ): Promise<{ suggestions: string[] }> {
    const suggestions = await this.roleplayService.suggestReplies(sessionId);
    return { suggestions };
  }

  @ApiOperation({ summary: 'Generate RAG summary for a completed session' })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Background job started',
  })
  @Post('summarize-for-rag')
  @HttpCode(HttpStatus.ACCEPTED)
  async summarizeForRag(
    @Body() dto: SummarizeRoleplayDto,
  ): Promise<{ message: string }> {
    // Fire and forget or handle asynchronously
    this.roleplayService.summarizeForRag(dto).catch(console.error);
    return { message: 'Summarization job started in the background' };
  }
}
