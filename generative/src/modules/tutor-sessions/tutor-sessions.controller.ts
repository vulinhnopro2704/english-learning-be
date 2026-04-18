import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiCreatedEntityResponse,
  ApiOkEntityResponse,
  ApiStandardErrorResponses,
} from '@english-learning/nest-api-docs';
import { CreateTutorSessionDto } from './dtos/create-tutor-session.dto';
import { InteractTutorSessionDto } from './dtos/interact-tutor-session.dto';
import { InteractVoiceTutorSessionDto } from './dtos/interact-voice-tutor-session.dto';
import {
  EndTutorSessionResponseDto,
  InterruptTutorSessionResponseDto,
  TutorInteractionResponseDto,
  TutorSessionResponseDto,
} from './dtos/tutor-session-response.dto';
import { TutorSessionsService } from './tutor-sessions.service';

@ApiTags('tutor-sessions')
@ApiBearerAuth()
@Controller('tutor/sessions')
export class TutorSessionsController {
  constructor(private readonly tutorSessionsService: TutorSessionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new 3D AI tutor session' })
  @ApiCreatedEntityResponse({
    type: TutorSessionResponseDto,
    description: 'Tutor session created',
  })
  @ApiStandardErrorResponses({ statuses: [400, 422, 500] })
  createSession(@Body() dto: CreateTutorSessionDto) {
    return this.tutorSessionsService.createSession(dto);
  }

  @Get(':sessionId')
  @ApiOperation({ summary: 'Get tutor session metadata and state' })
  @ApiParam({ name: 'sessionId', type: String })
  @ApiOkEntityResponse({
    type: TutorSessionResponseDto,
    description: 'Tutor session details',
  })
  @ApiStandardErrorResponses({ statuses: [404, 422, 500] })
  getSession(@Param('sessionId') sessionId: string) {
    return this.tutorSessionsService.getSession(sessionId);
  }

  @Post(':sessionId/interact')
  @ApiOperation({
    summary: 'Process a text interaction turn for the tutor session',
  })
  @ApiParam({ name: 'sessionId', type: String })
  @ApiOkEntityResponse({
    type: TutorInteractionResponseDto,
    description: 'Tutor interaction response',
  })
  @ApiStandardErrorResponses({ statuses: [404, 409, 422, 500] })
  interact(
    @Param('sessionId') sessionId: string,
    @Body() dto: InteractTutorSessionDto,
  ) {
    return this.tutorSessionsService.interact(sessionId, dto);
  }

  @Post(':sessionId/interact-voice')
  @ApiOperation({
    summary: 'Process a voice interaction turn for the tutor session',
  })
  @ApiParam({ name: 'sessionId', type: String })
  @ApiOkEntityResponse({
    type: TutorInteractionResponseDto,
    description: 'Tutor interaction response derived from voice input',
  })
  @ApiStandardErrorResponses({ statuses: [400, 404, 409, 422, 500] })
  interactVoice(
    @Param('sessionId') sessionId: string,
    @Body() dto: InteractVoiceTutorSessionDto,
  ) {
    return this.tutorSessionsService.interactVoice(sessionId, dto);
  }

  @Post(':sessionId/interrupt')
  @ApiOperation({ summary: 'Interrupt current tutor speaking turn' })
  @ApiParam({ name: 'sessionId', type: String })
  @ApiOkEntityResponse({
    type: InterruptTutorSessionResponseDto,
    description: 'Tutor session interruption state',
  })
  @ApiStandardErrorResponses({ statuses: [404, 409, 500] })
  interrupt(@Param('sessionId') sessionId: string) {
    return this.tutorSessionsService.interrupt(sessionId);
  }

  @Post(':sessionId/end')
  @ApiOperation({ summary: 'End tutor session and return summary' })
  @ApiParam({ name: 'sessionId', type: String })
  @ApiOkEntityResponse({
    type: EndTutorSessionResponseDto,
    description: 'Tutor session end summary',
  })
  @ApiStandardErrorResponses({ statuses: [404, 409, 500] })
  endSession(@Param('sessionId') sessionId: string) {
    return this.tutorSessionsService.endSession(sessionId);
  }
}
