# Generative Service — English Learning Platform

AI-powered backend service for the English Learning Platform, providing **3D AI Tutor sessions** and **Role-play conversations** using [Ollama Cloud](https://ollama.com) as the LLM provider.

## Architecture

```
[Web/Mobile Client]
        │
        ├──> POST /tutor/sessions          → Create tutor session
        ├──> POST /tutor/sessions/:id/interact      → Text interaction (essay grading)
        ├──> POST /tutor/sessions/:id/interact-voice → Voice interaction (STT + LLM + TTS)
        │
        ├──> GET  /roleplay/scenarios      → List available scenarios
        ├──> POST /roleplay/scenarios/generate → AI-generate a new scenario
        ├──> POST /roleplay/start          → Start roleplay session
        └──> POST /roleplay/chat           → Chat in roleplay session
```

### Model Routing

| Use Case | Model | Rationale |
|----------|-------|-----------|
| Essay Grading & Tutor Interactions | `gpt-oss:120b-cloud` | Deep reasoning, accuracy for corrections |
| Roleplay Chat & Scenario Generation | `qwen3.5:cloud` | Fast response, long context for conversations |

Both models run on **Ollama Cloud** — no local GPU required.

---

## Quick Start

### 1. Prerequisites

- **Node.js** ≥ 22
- **pnpm** package manager
- **Ollama Cloud API Key** — [Create one here](https://ollama.com/settings/keys)
- **PostgreSQL** database (Neon or local)
- **Redis** instance

### 2. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
PORT=3005

# Ollama Cloud configuration
OLLAMA_HOST="https://ollama.com"
OLLAMA_API_KEY="your_ollama_api_key_here"
OLLAMA_ESSAY_MODEL="gpt-oss:120b-cloud"
OLLAMA_CHAT_MODEL="qwen3.5:cloud"
OLLAMA_TEMPERATURE="0.5"

# Database
DATABASE_URL="postgresql://..."

# ElevenLabs (for TTS/STT)
ELEVENLABS_API_KEY="your_key"
ELEVENLABS_VOICE_ID="EXAVITQu4vr4xnSDxMaL"
ELEVENLABS_MODEL_ID="eleven_flash_v2_5"
ELEVENLABS_STT_MODEL_ID="scribe_v2"

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 3. Install & Run

```bash
pnpm install
pnpm run start:dev
```

The service starts at `http://localhost:3005`. API docs at `http://localhost:3005/api-docs`.

---

## FE Integration Guide

### Base URL

```
http://localhost:3005   (development)
```

### Authentication

All endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

---

### Tutor Sessions API

#### Create Session

```http
POST /tutor/sessions
Content-Type: application/json

{
  "cefrLevel": "A2",
  "focusTopics": ["daily_conversation", "pronunciation"],
  "voiceId": "EXAVITQu4vr4xnSDxMaL"  // optional
}
```

**Response** `201`:
```json
{
  "sessionId": "8e5c7a6d-3f2c-4d95-b6f1-fd76d2b2c6e9",
  "state": "ACTIVE",
  "tutorProfile": {
    "cefrLevel": "A2",
    "focusTopics": ["daily_conversation", "pronunciation"]
  },
  "createdAt": "2026-05-23T10:00:00.000Z",
  "turnsCount": 0
}
```

#### Text Interaction

```http
POST /tutor/sessions/:sessionId/interact
Content-Type: application/json

{
  "userInput": "I goed to school yesterday",
  "inputMode": "text",
  "clientTurnId": "turn-001"  // optional, for idempotency
}
```

**Response** `200`:
```json
{
  "turnId": "9a3d0f93-01bc-4e7b-ac0f-0179b9f40ca6",
  "sessionId": "8e5c7a6d-3f2c-4d95-b6f1-fd76d2b2c6e9",
  "tutorText": "Great effort! The correct form is: I went to school yesterday.",
  "emotionState": "CORRECTIVE_SOFT",
  "animationState": "GESTURE_EXPLAIN",
  "facialExpression": "concerned",
  "animation": "Talking_1",
  "correction": {
    "hasError": true,
    "correctedVersion": "I went to school yesterday.",
    "shortReason": "Use past tense: went (not goed)"
  },
  "audio": {
    "url": "data:audio/mpeg;base64,...",
    "mimeType": "audio/mpeg",
    "provider": "elevenlabs",
    "status": "completed",
    "source": "Voice by elevenlabs.io"
  },
  "createdAt": "2026-05-23T10:01:30.000Z"
}
```

#### Voice Interaction

```http
POST /tutor/sessions/:sessionId/interact-voice
Content-Type: application/json

{
  "audioBase64": "GkXfo59ChoEBQveBAULygQRC84EIQo...",
  "mimeType": "audio/webm",
  "languageCode": "eng",
  "clientTurnId": "turn-voice-001"
}
```

Same response as text interaction, plus a `transcript` field:
```json
{
  "...same fields as above...",
  "transcript": {
    "text": "I goed to school yesterday",
    "confidence": 0.98,
    "provider": "elevenlabs"
  }
}
```

#### Interrupt & End Session

```http
POST /tutor/sessions/:sessionId/interrupt
POST /tutor/sessions/:sessionId/end
```

---

### Roleplay API

#### List Scenarios

```http
GET /roleplay/scenarios
```

**Response** `200`:
```json
[
  {
    "id": "scenario-123",
    "title": "Job Interview",
    "description": "You are applying for a software engineer role",
    "aiPersona": "A strict hiring manager",
    "userPersona": "A confident candidate",
    "requiredTasks": ["Introduce yourself", "Explain experience", "Ask a question"],
    "level": "B1",
    "topic": "Business"
  }
]
```

#### Generate Scenario with AI

```http
POST /roleplay/scenarios/generate
Content-Type: application/json

{
  "topic": "Ordering coffee at a busy cafe",
  "level": "A2",
  "isPublic": true
}
```

#### Start Roleplay Session

```http
POST /roleplay/start
Content-Type: application/json

{
  "userId": "user-id-123",
  "scenarioId": "scenario-id-123"
}
```

**Response** `200`:
```json
{
  "sessionId": "session-id-456",
  "ai_first_message": "Welcome to The Bean Counter! What can I get you today?"
}
```

#### Chat in Roleplay

```http
POST /roleplay/chat
Content-Type: application/json

{
  "sessionId": "session-id-456",
  "userMessage": "Hi, I would like to order a cappuccino please."
}
```

**Response** `200`:
```json
{
  "ai_spoken_response": "Great choice! What size would you like?",
  "task_evaluation": {
    "task_1_completed": true,
    "task_2_completed": false,
    "task_3_completed": false
  },
  "grammar_feedback": null,
  "scenario_completed": false
}
```

---

### Error Handling

All errors follow a consistent format:

```json
{
  "statusCode": 502,
  "errorCode": "OLLAMA_CONNECTION_ERROR",
  "message": "Cannot connect to Ollama server: ..."
}
```

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `OLLAMA_CONNECTION_ERROR` | 502 | Cannot reach Ollama Cloud |
| `OLLAMA_MODEL_NOT_FOUND` | 502 | Requested model is unavailable |
| `OLLAMA_AUTH_ERROR` | 503 | Invalid or missing API key |
| `OLLAMA_RATE_LIMITED` | 429 | Too many requests |
| `OLLAMA_TIMEOUT` | 504 | Request timed out |
| `OLLAMA_ERROR` | 502 | Generic Ollama error |
| `LLM_PROVIDER_ERROR` | 502 | LLM returned invalid/empty response |
| `LLM_PARSE_ERROR` | 502 | LLM response couldn't be parsed as JSON |

### FE Error Handling Example (TypeScript)

```typescript
try {
  const response = await fetch(`${API_BASE}/tutor/sessions/${sessionId}/interact`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ userInput, inputMode: 'text' }),
  });

  if (!response.ok) {
    const error = await response.json();
    
    switch (error.errorCode) {
      case 'OLLAMA_RATE_LIMITED':
        // Show retry message
        showToast('Too many requests. Please wait a moment.');
        break;
      case 'OLLAMA_CONNECTION_ERROR':
      case 'OLLAMA_TIMEOUT':
        // Show connection error
        showToast('AI service is temporarily unavailable. Retrying...');
        break;
      case 'SESSION_EXPIRED':
        // Redirect to create new session
        router.push('/tutor/new');
        break;
      default:
        showToast(`Error: ${error.message}`);
    }
    return;
  }

  const data = await response.json();
  // Handle successful response...
} catch (networkError) {
  showToast('Network error. Check your connection.');
}
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3005` | Server port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `OLLAMA_HOST` | Yes | — | Ollama Cloud URL (`https://ollama.com`) |
| `OLLAMA_API_KEY` | Yes | — | Ollama Cloud API key |
| `OLLAMA_ESSAY_MODEL` | No | `gpt-oss:120b-cloud` | Model for essay grading/tutor |
| `OLLAMA_CHAT_MODEL` | No | `qwen3.5:cloud` | Model for roleplay/chat |
| `OLLAMA_TEMPERATURE` | No | `0.5` | Default LLM temperature (0.0–1.0) |
| `ELEVENLABS_API_KEY` | Yes | — | ElevenLabs API key for TTS/STT |
| `ELEVENLABS_VOICE_ID` | No | `EXAVITQu4vr4xnSDxMaL` | Default voice ID |
| `ELEVENLABS_MODEL_ID` | No | `eleven_flash_v2_5` | TTS model |
| `ELEVENLABS_STT_MODEL_ID` | No | `scribe_v2` | STT model |
| `CORS_ORIGIN` | No | `http://localhost:3001` | Allowed CORS origins (comma-separated) |
| `SWAGGER_ENABLED` | No | `true` | Enable API docs |
| `SWAGGER_PATH` | No | `api-docs` | API docs URL path |

---

## Docker

```bash
docker build -f Dockerfile -t generative-service .
docker run -p 3005:3005 --env-file .env generative-service
```

---

## Project Structure

```
src/
├── app.module.ts                  # Root module
├── main.ts                        # Application entry point
├── modules/
│   ├── ollama/                    # 🔌 Independent Ollama service
│   │   ├── ollama.module.ts       #   Global NestJS module
│   │   ├── ollama.service.ts      #   Ollama client wrapper
│   │   └── ollama.types.ts        #   TypeScript interfaces
│   ├── llm/                       # 🧠 Tutor LLM logic (uses essay model)
│   │   ├── llm.module.ts
│   │   ├── llm.service.ts
│   │   └── llm.types.ts
│   ├── roleplay/                  # 🎭 Roleplay system (uses chat model)
│   │   ├── roleplay.module.ts
│   │   ├── roleplay.controller.ts
│   │   ├── roleplay.service.ts
│   │   └── roleplay.types.ts
│   ├── tutor-sessions/            # 📚 Tutor session management
│   ├── tts/                       # 🔊 Text-to-Speech (ElevenLabs)
│   ├── stt/                       # 🎤 Speech-to-Text (ElevenLabs)
│   ├── redis/                     # ⚡ Redis cache layer
│   ├── db/                        # 🗄️ Prisma database
│   └── health/                    # ❤️ Health check
```
