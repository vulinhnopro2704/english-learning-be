import type { Message, Options } from 'ollama';

/**
 * Configuration for the Ollama client, loaded from environment variables.
 */
export interface OllamaConfig {
  host: string;
  apiKey: string;
  essayModel: string;
  chatModel: string;
  defaultTemperature: number;
  defaultNumCtx: number;
}

/**
 * Options for OllamaService.chat() method.
 */
export interface OllamaChatOptions {
  /** Which model profile to use: 'essay' → gpt-oss, 'chat' → qwen3.5 */
  modelProfile: 'essay' | 'chat';
  /** Conversation messages (role: user | assistant | system) */
  messages: Message[];
  /** Optional system prompt (prepended as system message if provided) */
  system?: string;
  /** Request JSON-formatted output. Default: false */
  json?: boolean;
  /** Override temperature for this specific call */
  temperature?: number;
  /** Additional Ollama model options */
  options?: Partial<Options>;
}

/**
 * Options for OllamaService.generate() method.
 */
export interface OllamaGenerateOptions {
  /** Which model profile to use */
  modelProfile: 'essay' | 'chat';
  /** The prompt text */
  prompt: string;
  /** Optional system prompt override */
  system?: string;
  /** Request JSON-formatted output. Default: false */
  json?: boolean;
  /** Override temperature for this specific call */
  temperature?: number;
  /** Additional Ollama model options */
  options?: Partial<Options>;
}

/**
 * Standardized chat response from OllamaService.
 */
export interface OllamaChatResult {
  /** The assistant's response content */
  content: string;
  /** Model used for this request */
  model: string;
  /** Duration of the request in nanoseconds (from Ollama) */
  totalDuration?: number;
  /** Number of tokens evaluated */
  evalCount?: number;
}

/**
 * Standardized generate response from OllamaService.
 */
export interface OllamaGenerateResult {
  /** The generated text response */
  response: string;
  /** Model used for this request */
  model: string;
  /** Duration of the request in nanoseconds */
  totalDuration?: number;
  /** Number of tokens evaluated */
  evalCount?: number;
}

// Re-export commonly used types from ollama package
export type { Message, Options } from 'ollama';
