import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../db/prisma.service';
import { ApiException } from '@english-learning/nest-error-handler';
import {
  StartRoleplayResult,
  ChatRoleplayResult,
  RoleplayLlmResponse,
} from './roleplay.types';
import { StartRoleplayDto, ChatRoleplayDto, SummarizeRoleplayDto } from './dtos/roleplay.dto';
import { CreateScenarioDto, GenerateScenarioDto } from './dtos/scenario.dto';

@Injectable()
export class RoleplayService {
  private readonly logger = new Logger(RoleplayService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
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

    const rawResponse = await this.generateText(prompt);
    
    let generatedData: any;
    try {
      const sanitized = rawResponse.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      generatedData = JSON.parse(sanitized);
    } catch (e) {
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

  async startSession(dto: StartRoleplayDto): Promise<StartRoleplayResult> {
    const { userId, scenarioId } = dto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'USER_NOT_FOUND',
        message: 'User not found',
      });
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

    const tasks = scenario.requiredTasks as unknown as string[];
    const systemPrompt = this.buildSystemPrompt(user, scenario, {
      task_1_completed: false,
      task_2_completed: false,
      task_3_completed: false,
    });

    // We make the first call to LLM to get the opening message
    const llmResponse = await this.callGemini(systemPrompt, []);

    // Save AI opening message
    await this.prisma.message.create({
      data: {
        sessionId: session.id,
        role: 'ai',
        content: llmResponse.ai_spoken_response,
      },
    });

    return {
      sessionId: session.id,
      ai_first_message: llmResponse.ai_spoken_response,
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

    // 1. Fetch last N messages
    const pastMessages = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 20, // Limit context history
    });

    // 2. Append new user message
    const newUserMsg = await this.prisma.message.create({
      data: {
        sessionId,
        role: 'user',
        content: userMessage,
      },
    });

    const chatHistory = [...pastMessages, newUserMsg].map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // 3. System prompt with updated task status
    const systemPrompt = this.buildSystemPrompt(session.user, session.scenario, {
      task_1_completed: session.sessionEvaluation.task1Completed,
      task_2_completed: session.sessionEvaluation.task2Completed,
      task_3_completed: session.sessionEvaluation.task3Completed,
    });

    // 4. Call LLM
    const llmResponse = await this.callGemini(systemPrompt, chatHistory);

    // 5. Update Evaluation
    const currentGrammarFeedback = (session.sessionEvaluation.grammarFeedback || []) as string[];
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

    if (llmResponse.scenario_completed) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { status: 'completed', endedAt: new Date() },
      });
      // Trigger background job for RAG summary (we can call the summary function here or via a queue)
      // this.summarizeForRag({ sessionId });
    }

    return llmResponse;
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

    // A separate call to generate the summary
    const summaryResponse = await this.generateText(prompt);

    // TODO: Convert `summaryResponse` and `grammarErrors` into embeddings
    // e.g., const embedding = await getEmbedding(summaryResponse);
    
    // TODO: Save to Vector DB (Pinecone, pgvector, etc.)
    // await vectorDb.save(session.userId, embedding, metadata);

    this.logger.log(`Summary for session ${sessionId} generated and ready for Vector DB.`);
    this.logger.debug(`Summary: ${summaryResponse}`);
  }

  private buildSystemPrompt(user: any, scenario: any, taskStatus: any): string {
    const tasks = scenario.requiredTasks as string[];
    
    return `
      Bạn là một AI Tutor dạy tiếng Anh thông qua giao tiếp nhập vai (Role-play). Bạn đang trò chuyện trực tiếp với người học.

      ## 1. Thông Tin Ngữ Cảnh (Context)
      - Tên người dùng: ${user.name}
      - Trình độ hiện tại: ${user.englishLevel}
      - Tình huống nhập vai (Scenario): ${scenario.description}
      - Vai trò của AI (AI Persona): ${scenario.aiPersona}
      - Vai trò của người dùng (User Persona): ${scenario.userPersona}

      ## 2. Nhiệm Vụ Của Người Dùng (User's Objectives)
      Trong cuộc hội thoại này, người dùng cần hoàn thành 3 nhiệm vụ sau. Bạn phải theo dõi sát sao lời nói của họ để đánh giá xem họ đã hoàn thành nhiệm vụ nào chưa.
      1. [Task_1]: ${tasks[0] || 'N/A'} (Trạng thái hiện tại: ${taskStatus.task_1_completed})
      2. [Task_2]: ${tasks[1] || 'N/A'} (Trạng thái hiện tại: ${taskStatus.task_2_completed})
      3. [Task_3]: ${tasks[2] || 'N/A'} (Trạng thái hiện tại: ${taskStatus.task_3_completed})

      ## 3. Quy Tắc Hoạt Động (Core Rules)
      - Tự nhiên & Ngắn gọn: Vì đây là hội thoại bằng giọng nói, câu trả lời của AI phải ngắn gọn (2-3 câu), tự nhiên, đối đáp. KHÔNG viết các đoạn văn dài.
      - Giữ đúng vai diễn: Không bao giờ phá vỡ vai diễn. Không nói "Tôi là AI". Hãy hành xử đúng với tính cách của AI.
      - Cá nhân hóa: Gọi tên người dùng đôi khi.
      - Dẫn dắt khéo léo: Đặt câu hỏi mở để dẫn dắt hoàn thành nhiệm vụ.
      - Sửa lỗi (Correction): Ghi chú lỗi ngữ pháp/từ vựng vào "grammar_feedback", không ngắt lời.

      ## 4. Cấu Trúc Trả Về (Output Format)
      Bạn BẮT BUỘC phải trả về dữ liệu DƯỚI DẠNG JSON HỢP LỆ (Valid JSON). Tuyệt đối không chứa bất kỳ văn bản nào ngoài JSON.
      {
        "ai_spoken_response": "Câu nói của bạn trong vai diễn.",
        "task_evaluation": {
          "task_1_completed": true/false,
          "task_2_completed": true/false,
          "task_3_completed": true/false
        },
        "grammar_feedback": "Ghi chú lỗi hoặc null.",
        "scenario_completed": true/false
      }
    `;
  }

  private async callGemini(systemPrompt: string, history: any[]): Promise<RoleplayLlmResponse> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const model = this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const contents: any[] = [];
    // If history is empty, it means we are just starting and need the opening message
    if (history.length > 0) {
      contents.push(...history);
    } else {
      contents.push({ role: 'user', parts: [{ text: 'Hello!' }] }); // Trigger the first response
    }

    const payload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.5,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'LLM_PROVIDER_ERROR',
        message: 'Failed to call Gemini API',
      });
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    
    try {
      const sanitized = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      return JSON.parse(sanitized) as RoleplayLlmResponse;
    } catch {
      throw new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'LLM_PARSE_ERROR',
        message: 'Failed to parse JSON from LLM',
      });
    }
  }

  private async generateText(prompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const model = this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      }),
    });

    if (!response.ok) return "Failed to generate summary";
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }
}
