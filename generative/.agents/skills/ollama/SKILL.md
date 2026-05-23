---
name: ollama
description: Use Cloud Ollama LLM service in the generative backend. Covers model routing, chat/generate APIs, error handling patterns, and configuration. Use when working with AI text generation, tutor sessions, roleplay, or any LLM integration.
---

# Ollama Integration Skill

This skill describes how to use the Ollama service in the English Learning Platform's generative backend.

## Overview

The `OllamaService` is a **global NestJS module** that wraps the [`ollama`](https://www.npmjs.com/package/ollama) npm package to provide LLM capabilities via [Ollama Cloud](https://ollama.com). It is the single point of contact for all AI text generation in the platform.

## Architecture

```
OllamaModule (Global)
    └── OllamaService
         ├── chat()     → Multi-turn conversations
         └── generate() → Single-prompt completions
              │
              ├── 'essay' profile → gpt-oss:120b-cloud (deep reasoning)
              └── 'chat' profile  → qwen3.5:cloud (fast, long context)
```

## Usage

### 1. Inject OllamaService

Since `OllamaModule` is `@Global()`, you can inject `OllamaService` into any service without importing the module:

```typescript
import { Injectable } from '@nestjs/common';
import { OllamaService } from '../ollama/ollama.service';

@Injectable()
export class MyService {
  constructor(private readonly ollamaService: OllamaService) {}
}
```

### 2. Chat API (Multi-turn Conversations)

Use `chat()` for conversations with history:

```typescript
const result = await this.ollamaService.chat({
  modelProfile: 'chat',  // or 'essay' for deep reasoning
  messages: [
    { role: 'user', content: 'Hello, how are you?' },
    { role: 'assistant', content: 'I am fine, thanks!' },
    { role: 'user', content: 'Tell me about London.' },
  ],
  system: 'You are an English tutor.',  // optional system prompt
  json: true,       // request JSON-formatted output
  temperature: 0.7, // override default temperature
});

console.log(result.content); // The assistant's response text
console.log(result.model);   // Model name used
```

### 3. Generate API (Single-prompt Completions)

Use `generate()` for one-off text generation:

```typescript
const result = await this.ollamaService.generate({
  modelProfile: 'essay',
  prompt: 'Evaluate this essay: ...',
  json: true,
  temperature: 0.3,
});

console.log(result.response); // Generated text
```

### 4. Model Profiles

| Profile | Model | Best For |
|---------|-------|----------|
| `essay` | `gpt-oss:120b-cloud` | Essay grading, tutor corrections, deep analysis |
| `chat`  | `qwen3.5:cloud` | Roleplay, scenario generation, fast conversations |

Model names are configurable via environment variables:
- `OLLAMA_ESSAY_MODEL` → defaults to `gpt-oss:120b-cloud`
- `OLLAMA_CHAT_MODEL` → defaults to `qwen3.5:cloud`

### 5. JSON Output

For structured output, set `json: true`:

```typescript
const result = await this.ollamaService.chat({
  modelProfile: 'chat',
  messages: [{ role: 'user', content: 'Return JSON: {"name": "test"}' }],
  json: true,
});

const parsed = JSON.parse(result.content);
```

### 6. Temperature

Temperature is configurable at three levels (highest priority first):
1. **Per-request**: `temperature` option in `chat()` or `generate()`
2. **Environment**: `OLLAMA_TEMPERATURE` env var
3. **Default**: `0.5`

## Error Handling

`OllamaService` catches all Ollama errors and converts them to `ApiException` with specific error codes:

| Error Code | HTTP Status | Cause |
|------------|-------------|-------|
| `OLLAMA_CONNECTION_ERROR` | 502 | Cannot reach Ollama server |
| `OLLAMA_MODEL_NOT_FOUND` | 502 | Model not available on cloud |
| `OLLAMA_AUTH_ERROR` | 503 | Invalid API key |
| `OLLAMA_RATE_LIMITED` | 429 | Too many requests |
| `OLLAMA_TIMEOUT` | 504 | Request timed out |
| `OLLAMA_ERROR` | 502 | Generic/unknown error |

All errors are logged with full details:
```
[Ollama] Chat failed — model=qwen3.5:cloud durationMs=1234 errorName=Error errorMessage=... statusCode=429
```

### Catching Errors in Consuming Services

```typescript
try {
  const result = await this.ollamaService.chat({ ... });
} catch (error) {
  // OllamaService already throws ApiException
  // You can re-throw or wrap with additional context
  throw error;
}
```

## Environment Variables

```env
OLLAMA_HOST="https://ollama.com"           # Required: Ollama Cloud URL
OLLAMA_API_KEY="your_api_key"              # Required: API key from ollama.com/settings/keys
OLLAMA_ESSAY_MODEL="gpt-oss:120b-cloud"    # Optional: Essay/tutor model
OLLAMA_CHAT_MODEL="qwen3.5:cloud"          # Optional: Chat/roleplay model  
OLLAMA_TEMPERATURE="0.5"                   # Optional: Default temperature
```

## Files

- `src/modules/ollama/ollama.module.ts` — Global NestJS module
- `src/modules/ollama/ollama.service.ts` — Client wrapper with error handling
- `src/modules/ollama/ollama.types.ts` — TypeScript interfaces

## Adding a New Model Profile

To add a new model profile (e.g., for embeddings):

1. Add env var to `.env.example`: `OLLAMA_EMBED_MODEL="nomic-embed-text:cloud"`
2. Add to `OllamaConfig` interface in `ollama.types.ts`
3. Load in `loadConfig()` in `ollama.service.ts`
4. Extend `modelProfile` union type: `'essay' | 'chat' | 'embed'`
5. Add case in `resolveModel()` method
