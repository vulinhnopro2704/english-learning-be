import { Injectable, Logger, HttpStatus, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ollama } from 'ollama';
import { ApiException } from '@english-learning/nest-error-handler';
import type {
  OllamaConfig,
  OllamaChatOptions,
  OllamaChatResult,
  OllamaGenerateOptions,
  OllamaGenerateResult,
} from './ollama.types';

@Injectable()
export class OllamaService implements OnModuleInit {
  private readonly logger = new Logger(OllamaService.name);
  private client: Ollama;
  private config: OllamaConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
    this.client = new Ollama({
      host: this.config.host,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(
      `[Ollama] Initializing client — host=${this.config.host} essayModel=${this.config.essayModel} chatModel=${this.config.chatModel} defaultTemperature=${this.config.defaultTemperature}`,
    );

    try {
      const versionResponse = await this.client.version();
      this.logger.log(
        `[Ollama] Connection verified — version=${versionResponse.version ?? 'unknown'}`,
      );
    } catch (error) {
      this.logger.warn(
        `[Ollama] Could not verify connection on startup — error=${this.stringifyError(error)}. Service will attempt requests on demand.`,
      );
    }
  }

  /**
   * Chat completion using Ollama's chat API.
   * Supports multi-turn conversations with system prompts.
   */
  async chat(options: OllamaChatOptions): Promise<OllamaChatResult> {
    const model = this.resolveModel(options.modelProfile);
    const temperature = options.temperature ?? this.config.defaultTemperature;
    const startTime = Date.now();

    // Build messages array with optional system prompt
    const messages = [...options.messages];
    if (options.system && !messages.some((m) => m.role === 'system')) {
      messages.unshift({ role: 'system', content: options.system });
    }

    this.logger.log(
      `[Ollama] Chat request — model=${model} profile=${options.modelProfile} messageCount=${messages.length} json=${!!options.json} temperature=${temperature}`,
    );

    try {
      const response = await this.client.chat({
        model,
        messages,
        format: options.json ? 'json' : undefined,
        stream: false,
        options: {
          temperature,
          ...options.options,
        },
      });

      const durationMs = Date.now() - startTime;
      this.logger.log(
        `[Ollama] Chat response — model=${model} durationMs=${durationMs} evalCount=${response.eval_count ?? 'N/A'} contentLength=${response.message?.content?.length ?? 0}`,
      );

      return {
        content: response.message?.content ?? '',
        model: response.model,
        totalDuration: response.total_duration,
        evalCount: response.eval_count,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.logOllamaError('Chat', model, durationMs, error);
      throw this.classifyOllamaError(error);
    }
  }

  /**
   * Simple text generation using Ollama's generate API.
   * Best for single-prompt completions without conversation history.
   */
  async generate(
    options: OllamaGenerateOptions,
  ): Promise<OllamaGenerateResult> {
    const model = this.resolveModel(options.modelProfile);
    const temperature = options.temperature ?? this.config.defaultTemperature;
    const startTime = Date.now();

    this.logger.log(
      `[Ollama] Generate request — model=${model} profile=${options.modelProfile} promptLength=${options.prompt.length} json=${!!options.json} temperature=${temperature}`,
    );

    try {
      const response = await this.client.generate({
        model,
        prompt: options.prompt,
        system: options.system,
        format: options.json ? 'json' : undefined,
        stream: false,
        options: {
          temperature,
          ...options.options,
        },
      });

      const durationMs = Date.now() - startTime;
      this.logger.log(
        `[Ollama] Generate response — model=${model} durationMs=${durationMs} evalCount=${response.eval_count ?? 'N/A'} responseLength=${response.response?.length ?? 0}`,
      );

      return {
        response: response.response ?? '',
        model: response.model,
        totalDuration: response.total_duration,
        evalCount: response.eval_count,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.logOllamaError('Generate', model, durationMs, error);
      throw this.classifyOllamaError(error);
    }
  }

  /**
   * Resolve model name from profile key.
   */
  private resolveModel(profile: 'essay' | 'chat'): string {
    return profile === 'essay' ? this.config.essayModel : this.config.chatModel;
  }

  /**
   * Load and validate configuration from environment variables.
   */
  private loadConfig(): OllamaConfig {
    const host = this.configService.get<string>('OLLAMA_HOST');
    if (!host) {
      throw new Error(
        '[Ollama] Missing required env var OLLAMA_HOST. Example: https://ollama.com',
      );
    }

    const apiKey = this.configService.get<string>('OLLAMA_API_KEY');
    if (!apiKey) {
      throw new Error(
        '[Ollama] Missing required env var OLLAMA_API_KEY. Create one at https://ollama.com/settings/keys',
      );
    }

    const essayModel =
      this.configService.get<string>('OLLAMA_ESSAY_MODEL') ??
      'gpt-oss:120b-cloud';
    const chatModel =
      this.configService.get<string>('OLLAMA_CHAT_MODEL') ?? 'qwen3.5:cloud';
    const defaultTemperature = parseFloat(
      this.configService.get<string>('OLLAMA_TEMPERATURE') ?? '0.5',
    );

    return { host, apiKey, essayModel, chatModel, defaultTemperature };
  }

  /**
   * Log detailed Ollama error information for debugging.
   */
  private logOllamaError(
    operation: string,
    model: string,
    durationMs: number,
    error: unknown,
  ): void {
    const errorDetails = this.extractErrorDetails(error);
    this.logger.error(
      `[Ollama] ${operation} failed — model=${model} durationMs=${durationMs} ` +
        `errorName=${errorDetails.name} errorMessage=${errorDetails.message} ` +
        `statusCode=${errorDetails.statusCode ?? 'N/A'} ` +
        `errorBody=${errorDetails.body ?? 'N/A'}`,
    );
  }

  /**
   * Extract structured details from an Ollama error.
   */
  private extractErrorDetails(error: unknown): {
    name: string;
    message: string;
    statusCode?: number;
    body?: string;
  } {
    if (error instanceof Error) {
      // Ollama SDK errors may have status_code or cause
      const ollamaError = error as Error & {
        status_code?: number;
        cause?: unknown;
      };
      return {
        name: error.name,
        message: error.message,
        statusCode: ollamaError.status_code,
        body:
          typeof ollamaError.cause === 'string' ? ollamaError.cause : undefined,
      };
    }

    return {
      name: 'UnknownError',
      message: String(error),
    };
  }

  /**
   * Classify Ollama errors into appropriate API exceptions.
   */
  private classifyOllamaError(error: unknown): ApiException {
    const details = this.extractErrorDetails(error);
    const message = details.message.toLowerCase();

    // Connection / network errors
    if (
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('fetch failed') ||
      message.includes('network')
    ) {
      return new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'OLLAMA_CONNECTION_ERROR',
        message: `Cannot connect to Ollama server: ${details.message}`,
      });
    }

    // Model not found
    if (
      message.includes('model') &&
      (message.includes('not found') || message.includes('does not exist'))
    ) {
      return new ApiException({
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'OLLAMA_MODEL_NOT_FOUND',
        message: `Ollama model not available: ${details.message}`,
      });
    }

    // Authentication errors
    if (details.statusCode === 401 || details.statusCode === 403) {
      return new ApiException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        errorCode: 'OLLAMA_AUTH_ERROR',
        message: `Ollama authentication failed: ${details.message}`,
      });
    }

    // Rate limiting
    if (
      details.statusCode === 429 ||
      message.includes('rate limit') ||
      message.includes('too many requests')
    ) {
      return new ApiException({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        errorCode: 'OLLAMA_RATE_LIMITED',
        message: `Ollama rate limit exceeded: ${details.message}`,
      });
    }

    // Timeout
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('aborted')
    ) {
      return new ApiException({
        statusCode: HttpStatus.GATEWAY_TIMEOUT,
        errorCode: 'OLLAMA_TIMEOUT',
        message: `Ollama request timed out: ${details.message}`,
      });
    }

    // Generic fallback
    return new ApiException({
      statusCode: HttpStatus.BAD_GATEWAY,
      errorCode: 'OLLAMA_ERROR',
      message: `Ollama request failed: ${details.message}`,
    });
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }
    return String(error);
  }
}
