import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { ApiException } from '@english-learning/nest-error-handler';
import { OllamaService } from '../ollama/ollama.service';
import {
  StartRoleplayResult,
  ChatRoleplayResult,
  RoleplayLlmResponse,
  ChatVoiceRoleplayResult,
  TaskEvaluation,
} from './roleplay.types';
import {
  StartRoleplayDto,
  ChatRoleplayDto,
  SummarizeRoleplayDto,
  ChatVoiceRoleplayDto,
} from './dtos/roleplay.dto';
import {
  CreateScenarioDto,
  GenerateScenarioDto,
  UpdateScenarioDto,
} from './dtos/scenario.dto';
import { TtsService } from '../tts/tts.service';
import { SttService } from '../stt/stt.service';

@Injectable()
export class RoleplayService {
  private readonly logger = new Logger(RoleplayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ollamaService: OllamaService,
    private readonly ttsService: TtsService,
    private readonly sttService: SttService,
  ) {}

  async getScenarios(filters?: any) {
    return this.prisma.scenario.findMany({
      where: {
        isPublic: true,
        ...filters,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createScenario(dto: CreateScenarioDto, creatorId?: string) {
    return this.prisma.scenario.create({
      data: {
        title: dto.title,
        description: dto.description,
        aiPersona: dto.aiPersona,
        userPersona: dto.userPersona,
        requiredTasks: dto.requiredTasks,
        level: dto.level,
        topic: dto.topic,
        isPublic: dto.isPublic ?? true,
        creatorId,
        type: 'SYSTEM',
      },
    });
  }

  async generateScenario(dto: GenerateScenarioDto, creatorId?: string) {
    const prompt = `
      You are an expert English teacher designing a role-play scenario for a student.
      Topic: ${dto.topic}
      Student Level: ${dto.level}

      Design a compelling role-play scenario. 
      You MUST return ONLY a valid JSON object matching this structure (no markdown, no extra text):
      {
        "title": "Short catchy title for the scenario",
        "description": "Brief description of the situation",
        "aiPersona": "Who the AI is playing (e.g. 'A strict interviewer', 'A friendly barista')",
        "userPersona": "Who the user is playing (e.g. 'A job applicant', 'A customer')",
        "requiredTasks": [
          "Task 1 that the user must achieve",
          "Task 2 that the user must achieve",
          "Task 3 that the user must achieve"
        ]
      }
    `;

    this.logger.log(
      `[Roleplay] Generating scenario — topic=${dto.topic} level=${dto.level}`,
    );

    const result = await this.ollamaService.generate({
      modelProfile: 'chat',
      prompt,
      json: true,
    });

    const rawResponse = result.response;

    let generatedData: any;
    try {
      let sanitized = rawResponse.trim();
      const startIdx = sanitized.indexOf('{');
      const endIdx = sanitized.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        sanitized = sanitized.slice(startIdx, endIdx + 1);
      } else {
        sanitized = sanitized
          .replace(/^```json\s*/i, '')
          .replace(/```$/i, '')
          .trim();
      }
      generatedData = JSON.parse(sanitized);
    } catch {
      this.logger.error(
        `[Roleplay] Failed to parse generated scenario — rawPreview=${rawResponse.slice(0, 500)}`,
      );
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'LLM_PARSE_ERROR',
        message: 'Failed to parse generated scenario from LLM',
      });
    }

    return this.prisma.scenario.create({
      data: {
        title: generatedData.title,
        description: generatedData.description,
        aiPersona: generatedData.aiPersona,
        userPersona: generatedData.userPersona,
        requiredTasks: generatedData.requiredTasks,
        level: dto.level,
        topic: dto.topic,
        isPublic: dto.isPublic ?? true,
        creatorId,
        type: 'AI_GENERATED',
      },
    });
  }

  async updateScenario(id: string, dto: UpdateScenarioDto) {
    const scenario = await this.prisma.scenario.findUnique({ where: { id } });
    if (!scenario) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'SCENARIO_NOT_FOUND',
        message: `Scenario with ID ${id} not found`,
      });
    }
    return this.prisma.scenario.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        aiPersona: dto.aiPersona,
        userPersona: dto.userPersona,
        requiredTasks: dto.requiredTasks,
        level: dto.level,
        topic: dto.topic,
        isPublic: dto.isPublic,
      },
    });
  }

  async deleteScenario(id: string) {
    const scenario = await this.prisma.scenario.findUnique({ where: { id } });
    if (!scenario) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'SCENARIO_NOT_FOUND',
        message: `Scenario with ID ${id} not found`,
      });
    }
    await this.prisma.scenario.delete({ where: { id } });
    return { message: 'Scenario deleted successfully' };
  }

  async startSession(
    dto: StartRoleplayDto,
    userId: string,
    userEmail?: string,
  ): Promise<StartRoleplayResult> {
    const { scenarioId } = dto;

    let user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      const name = userEmail ? userEmail.split('@')[0] : 'Learner';
      user = await this.prisma.user.create({
        data: {
          id: userId,
          name,
          englishLevel: 'A2',
        },
      });
      this.logger.log(
        `[Roleplay] Automatically synchronized user id=${userId} email=${userEmail} into generative schema`,
      );
    }

    const scenario = await this.prisma.scenario.findUnique({
      where: { id: scenarioId },
    });
    if (!scenario) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'SCENARIO_NOT_FOUND',
        message: 'Scenario not found',
      });
    }

    // Create a new Session
    const session = await this.prisma.session.create({
      data: {
        userId,
        scenarioId,
        status: 'active',
      },
    });

    // Create session evaluation tracking
    await this.prisma.sessionEvaluation.create({
      data: {
        sessionId: session.id,
      },
    });

    const systemPrompt = this.buildSystemPrompt(user, scenario, {
      task_1_completed: false,
      task_2_completed: false,
      task_3_completed: false,
    });

    // We make the first call to LLM to get the opening message
    const llmResponse = await this.callOllama(systemPrompt, [], {
      task_1_completed: false,
      task_2_completed: false,
      task_3_completed: false,
    });

    // Save AI opening message
    await this.prisma.message.create({
      data: {
        sessionId: session.id,
        role: 'ai',
        content: llmResponse.ai_spoken_response,
      },
    });

    let audioResult: any = null;
    if (!dto.skipTts) {
      try {
        audioResult = await this.ttsService.synthesize(
          llmResponse.ai_spoken_response,
        );
      } catch (e) {
        this.logger.error(
          `[Roleplay:TTS] Synthesis failed in startSession: ${(e as any).message}`,
        );
      }
    } else {
      audioResult = {
        url: null,
        mimeType: 'audio/mpeg',
        provider: 'elevenlabs',
        status: 'skipped',
        source: 'Voice by elevenlabs.io',
      };
    }

    return {
      sessionId: session.id,
      ai_first_message: llmResponse.ai_spoken_response,
      audio: audioResult,
    };
  }

  async chat(dto: ChatRoleplayDto): Promise<ChatRoleplayResult> {
    const { sessionId, userMessage } = dto;

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: true,
        scenario: true,
        sessionEvaluation: true,
      },
    });

    if (!session || !session.sessionEvaluation) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    if (session.status === 'completed') {
      throw new ApiException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'SESSION_COMPLETED',
        message: 'This session has already been completed',
      });
    }

    // 1. Fetch last N messages (newest first, then reversed for chronological order)
    const pastMessages = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 20, // Limit context history
    });
    pastMessages.reverse();

    // 2. Append new user message
    const newUserMsg = await this.prisma.message.create({
      data: {
        sessionId,
        role: 'user',
        content: userMessage,
      },
    });

    const chatHistory = [...pastMessages, newUserMsg].map((msg) => ({
      role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.content,
    }));

    // 3. System prompt with updated task status
    const systemPrompt = this.buildSystemPrompt(
      session.user,
      session.scenario,
      {
        task_1_completed: session.sessionEvaluation.task1Completed,
        task_2_completed: session.sessionEvaluation.task2Completed,
        task_3_completed: session.sessionEvaluation.task3Completed,
      },
    );

    // 4. Call LLM
    const currentStatus = {
      task_1_completed: session.sessionEvaluation.task1Completed,
      task_2_completed: session.sessionEvaluation.task2Completed,
      task_3_completed: session.sessionEvaluation.task3Completed,
    };
    const llmResponse = await this.callOllama(
      systemPrompt,
      chatHistory,
      currentStatus,
    );

    // 5. Update Evaluation
    const currentGrammarFeedback = (session.sessionEvaluation.grammarFeedback ||
      []) as string[];
    if (llmResponse.grammar_feedback) {
      currentGrammarFeedback.push(llmResponse.grammar_feedback);
    }

    await this.prisma.sessionEvaluation.update({
      where: { id: session.sessionEvaluation.id },
      data: {
        task1Completed: llmResponse.task_evaluation.task_1_completed,
        task2Completed: llmResponse.task_evaluation.task_2_completed,
        task3Completed: llmResponse.task_evaluation.task_3_completed,
        grammarFeedback: currentGrammarFeedback,
      },
    });

    // 6. Save AI Response
    await this.prisma.message.create({
      data: {
        sessionId,
        role: 'ai',
        content: llmResponse.ai_spoken_response,
      },
    });

    let audioResult: any = null;
    if (!dto.skipTts) {
      try {
        audioResult = await this.ttsService.synthesize(
          llmResponse.ai_spoken_response,
        );
      } catch (e) {
        this.logger.error(
          `[Roleplay:TTS] Synthesis failed in chat: ${(e as any).message}`,
        );
      }
    } else {
      audioResult = {
        url: null,
        mimeType: 'audio/mpeg',
        provider: 'elevenlabs',
        status: 'skipped',
        source: 'Voice by elevenlabs.io',
      };
    }

    if (llmResponse.scenario_completed) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { status: 'completed', endedAt: new Date() },
      });
      // Trigger background job for RAG summary (we can call the summary function here or via a queue)
      // this.summarizeForRag({ sessionId });
    }

    return {
      ...llmResponse,
      audio: audioResult,
    };
  }

  async summarizeForRag(dto: SummarizeRoleplayDto): Promise<void> {
    const { sessionId } = dto;
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: true,
        sessionEvaluation: true,
      },
    });

    if (!session || !session.sessionEvaluation) return;

    const messages = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    const conversationTranscript = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
      .join('\n');

    const grammarErrors = session.sessionEvaluation.grammarFeedback as string[];

    const prompt = `
      Evaluate the user's English speaking performance in this scenario.
      Conversation Transcript:
      ${conversationTranscript}

      Grammar Feedback gathered:
      ${JSON.stringify(grammarErrors)}

      Provide a concise summary highlighting strengths and weaknesses.
    `;

    this.logger.log(
      `[Roleplay] Generating RAG summary — sessionId=${sessionId} messageCount=${messages.length}`,
    );

    // A separate call to generate the summary
    const result = await this.ollamaService.generate({
      modelProfile: 'chat',
      prompt,
    });

    const summaryResponse = result.response;

    // TODO: Convert `summaryResponse` and `grammarErrors` into embeddings
    // e.g., const embedding = await getEmbedding(summaryResponse);

    // TODO: Save to Vector DB (Pinecone, pgvector, etc.)
    // await vectorDb.save(session.userId, embedding, metadata);

    this.logger.log(
      `Summary for session ${sessionId} generated and ready for Vector DB.`,
    );
    this.logger.debug(`Summary: ${summaryResponse}`);
  }

  private buildSystemPrompt(user: any, scenario: any, taskStatus: any): string {
    const tasks = scenario.requiredTasks as string[];

    return `
      You are an AI English Tutor who teaches through role-play conversations. You are speaking directly with the learner.

      ## 1. Context
      - User name: ${user.name}
      - Current level: ${user.englishLevel}
      - Role-play scenario: ${scenario.description}
      - AI persona: ${scenario.aiPersona}
      - User persona: ${scenario.userPersona}

      ## 2. User's Objectives
      The user has up to 3 tasks to complete. Monitor the conversation and evaluate their progress:
      1. [Task_1]: ${tasks[0] || 'N/A'} (Current status: ${taskStatus.task_1_completed})
      2. [Task_2]: ${tasks[1] || 'N/A'} (Current status: ${taskStatus.task_2_completed})
      3. [Task_3]: ${tasks[2] || 'N/A'} (Current status: ${taskStatus.task_3_completed})

      ## 3. Core Rules
      - Natural & Concise: Since this is a voice conversation, your responses must be short (2-3 sentences), natural, and conversational. DO NOT write long paragraphs.
      - Stay in character: Never break character. Never say "I am an AI". Always behave according to your assigned persona.
      - Personalize: Occasionally address the user by name.
      - Guide skillfully: Ask open-ended questions to guide the user toward completing their tasks.
      - Correction: Note any grammar or vocabulary errors in the "grammar_feedback" field without interrupting the conversation flow.
      - State Persistence: If a Task's current status is "true", it has already been completed in a previous turn. You MUST keep it as "true". Never change a completed task back to "false".
      - N/A Tasks: If a task description is "N/A", its status must always be "false" and can be ignored.
      - Scenario Completion: Set "scenario_completed" to true only when all non-N/A tasks are completed (status is true) and you are ending/wrapping up the conversation, or if the user explicitly says goodbye.

      ## 4. Output Format
      You MUST return data as VALID JSON only. Do not include any text outside the JSON object.
      All JSON values for task status and scenario completion must be raw boolean types (true or false), not strings.
      {
        "ai_spoken_response": "Your in-character spoken response.",
        "task_evaluation": {
          "task_1_completed": true,
          "task_2_completed": false,
          "task_3_completed": false
        },
        "grammar_feedback": "Grammar/vocabulary error notes, or null if none.",
        "scenario_completed": false
      }
    `;
  }

  private async callOllama(
    systemPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    currentStatus?: TaskEvaluation,
  ): Promise<RoleplayLlmResponse> {
    // Build messages: if history is empty, trigger the first response
    const messages =
      history.length > 0
        ? history
        : [{ role: 'user' as const, content: 'Hello!' }];

    this.logger.log(
      `[Roleplay] Calling Ollama — messageCount=${messages.length} systemPromptLength=${systemPrompt.length}`,
    );

    const result = await this.ollamaService.chat({
      modelProfile: 'chat',
      messages,
      system: systemPrompt,
      json: true,
      options: {
        num_predict: 1800, // Limit response token length for faster generation
      },
    });

    const rawText = result.content;

    try {
      let sanitized = rawText.trim();
      const startIdx = sanitized.indexOf('{');
      const endIdx = sanitized.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        sanitized = sanitized.slice(startIdx, endIdx + 1);
      } else {
        sanitized = sanitized
          .replace(/^```json\s*/i, '')
          .replace(/```$/i, '')
          .trim();
      }
      return JSON.parse(sanitized) as RoleplayLlmResponse;
    } catch (error) {
      this.logger.warn(
        `[Roleplay] Failed to parse JSON from Ollama, using fallback parser. Error: ${error instanceof Error ? error.message : String(error)}. Raw: ${rawText.slice(0, 200)}`,
      );

      const fallbackResponse = rawText.trim() || 'I see. Please go on.';
      return {
        ai_spoken_response: fallbackResponse,
        task_evaluation: currentStatus ?? {
          task_1_completed: false,
          task_2_completed: false,
          task_3_completed: false,
        },
        grammar_feedback: null,
        scenario_completed: false,
      };
    }
  }

  async chatVoice(dto: ChatVoiceRoleplayDto): Promise<ChatVoiceRoleplayResult> {
    const { sessionId, audioBase64, mimeType } = dto;

    this.logger.log(
      `[Roleplay] Transcribing voice input for session=${sessionId} mimeType=${mimeType}`,
    );
    const transcribeResult = await this.sttService.transcribe({
      audioBase64,
      mimeType,
    });

    const userMessage = transcribeResult.text;
    this.logger.log(`[Roleplay] Transcribed successfully: "${userMessage}"`);

    // Reuse standard chat logic to evaluate and get LLM response
    const chatResult = await this.chat({
      sessionId,
      userMessage,
      skipTts: dto.skipTts,
    });

    return {
      user_spoken_transcript: userMessage,
      ai_spoken_response: chatResult.ai_spoken_response,
      task_evaluation: chatResult.task_evaluation,
      grammar_feedback: chatResult.grammar_feedback,
      scenario_completed: chatResult.scenario_completed,
      audio: chatResult.audio,
    };
  }

  async getSessionHistory(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      include: {
        scenario: true,
        sessionEvaluation: true,
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getSessionDetails(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        scenario: true,
        sessionEvaluation: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    return session;
  }

  async translateMessage(text: string): Promise<string> {
    const systemPrompt = `You are an expert English-Vietnamese translator. Translate the following English text to Vietnamese. Provide only the translation, no extra text or explanation.`;

    // Call LLM for translation
    const response = await this.ollamaService.chat({
      modelProfile: 'chat',
      messages: [{ role: 'user', content: text }],
      system: systemPrompt,
    });

    return response.content.trim();
  }

  async suggestReplies(sessionId: string): Promise<string[]> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { scenario: true },
    });

    if (!session) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    const messages = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const recentContext = messages
      .reverse()
      .map((m) => `${m.role === 'user' ? 'User' : 'Tutor'}: ${m.content}`)
      .join('\n');

    const systemPrompt = `You are a helpful English Tutor. The user is in a roleplay scenario: "${session.scenario.title}".
Here is the recent conversation:
${recentContext}

Based on this, suggest exactly 3 short, natural English replies the User could say next.
Provide the output strictly as a JSON array of 3 strings. Example: ["Suggestion 1", "Suggestion 2", "Suggestion 3"]. Do not include any other text.`;

    const response = await this.ollamaService.chat({
      modelProfile: 'chat',
      messages: [],
      system: systemPrompt,
    });

    try {
      let sanitized = response.content;
      const startIdx = sanitized.indexOf('[');
      const endIdx = sanitized.lastIndexOf(']');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        sanitized = sanitized.slice(startIdx, endIdx + 1);
      }
      const parsed = JSON.parse(sanitized);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  }

  async synthesizeTts(text: string, voiceId?: string) {
    return this.ttsService.synthesize(text, voiceId);
  }

  async synthesizeTtsStream(text: string, voiceId?: string): Promise<Response> {
    return this.ttsService.synthesizeStream(text, voiceId);
  }
}
