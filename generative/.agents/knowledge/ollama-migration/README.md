# Ollama Migration Knowledge Base

## Context

This project migrated from **Google Gemini API** (direct REST `fetch` calls) to **Ollama Cloud** (via the `ollama` npm package) in May 2026. The migration was done to use open-source models for a university PBL project that requires stable, cloud-hosted LLM inference.

## Key Decisions

### Why Ollama Cloud (not self-hosted)

- **Stability**: University PBL project requires reliable uptime — no GPU management
- **No infrastructure**: Cloud models run on Ollama's infrastructure at `https://ollama.com`
- **Cost**: Free tier available with API key authentication

### Model Selection

| Use Case | Before (Gemini) | After (Ollama Cloud) | Reasoning |
|----------|-----------------|----------------------|-----------|
| Essay Grading & Tutor | `gemini-2.0-flash` | `gpt-oss:120b-cloud` | Needs deep reasoning for accurate corrections |
| Roleplay & Chat | `gemini-2.0-flash` | `qwen3.5:cloud` | Needs fast responses with long context for conversations |

### Architecture Decision: Independent OllamaService

The `OllamaService` was designed as a **`@Global()` NestJS module** so that:
1. All services can inject it without explicit module imports
2. Single Ollama client instance (connection pooling)
3. Centralized error handling and logging
4. Easy to swap models or add new profiles

## API Differences: Gemini vs Ollama

| Feature | Gemini (Before) | Ollama (After) |
|---------|-----------------|----------------|
| Auth | API key in URL query param | Bearer token in header |
| Chat API | `POST .../generateContent` with `contents[]` | `ollama.chat()` with `messages[]` |
| Role names | `user`, `model` | `user`, `assistant`, `system` |
| System prompt | `systemInstruction.parts[].text` | `system` message role or `system` option |
| JSON mode | `responseMimeType: 'application/json'` | `format: 'json'` |
| Temperature | `generationConfig.temperature` | `options.temperature` |
| Response text | `candidates[0].content.parts[].text` | `response.message.content` (chat) or `response.response` (generate) |
| NPM package | None (raw `fetch`) | `ollama` package |

## Troubleshooting

### "Cannot connect to Ollama server"
- Check `OLLAMA_HOST` is set to `https://ollama.com`
- Check network connectivity from the server

### "Ollama authentication failed"
- Verify `OLLAMA_API_KEY` at https://ollama.com/settings/keys
- Ensure the key has not been revoked

### "Model not available"
- Run `ollama pull <model>` after signing in with `ollama signin`
- Or check available cloud models at https://ollama.com/search?c=cloud

### "Ollama rate limit exceeded"
- Ollama Cloud has rate limits per API key
- Implement client-side retry with exponential backoff
- Consider upgrading the Ollama plan if needed

### JSON Parse Errors
- The `format: 'json'` option tells Ollama to output valid JSON
- Some models may still wrap JSON in markdown code blocks — the services sanitize this
- If persistent, check the prompt explicitly asks for "valid JSON only, no markdown"

## Files Modified During Migration

| File | Changes |
|------|---------|
| `src/modules/ollama/*` | **NEW** — Independent Ollama service |
| `src/modules/llm/llm.service.ts` | Replaced Gemini `fetch` calls with `OllamaService.chat()` |
| `src/modules/roleplay/roleplay.service.ts` | Replaced `callGemini()` / `generateText()` with OllamaService |
| `src/app.module.ts` | Added `OllamaModule` import |
| `.env.example` / `.env` | Replaced `GEMINI_*` vars with `OLLAMA_*` vars |
| `package.json` | Added `ollama` dependency |
| `README.md` | Full rewrite with FE integration guide |

## Environment Variables (Before → After)

```diff
- GEMINI_API_KEY="..."
- GEMINI_MODEL="gemini-2.0-flash"
+ OLLAMA_HOST="https://ollama.com"
+ OLLAMA_API_KEY="..."
+ OLLAMA_ESSAY_MODEL="gpt-oss:120b-cloud"
+ OLLAMA_CHAT_MODEL="qwen3.5:cloud"
+ OLLAMA_TEMPERATURE="0.5"
```
