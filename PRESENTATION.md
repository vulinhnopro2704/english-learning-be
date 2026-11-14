# System Architecture & Technical Presentation Guide

## Project Title

**Intelligent English Learning Platform: Integrating FSRS v6 Spaced Repetition, Generative AI Context Generation, and High-Performance Modular Monolith Architecture**

---

## 1. Executive Summary

This project presents an enterprise-grade English learning system engineered for personalized vocabulary retention, interactive listening comprehension, and conversational AI practice. Originally designed as a distributed microservices network, the backend was consolidated into a NestJS Modular Monolith to eliminate inter-service network overhead, simplify operations, reduce memory footprint by 90%, and guarantee atomic ACID transactions across multi-schema PostgreSQL.

---

## 2. Core Pillars of the Platform

### 2.1. Free Spaced Repetition Scheduler (FSRS v6)
- **Cognitive Science Foundation**: Replaces legacy heuristics (Leitner boxes, SuperMemo SM-2) with the DHP (Difficulty, Stability, Retrievability) cognitive memory model based on the Ebbinghaus forgetting curve.
- **Dynamic Optimization**: Analyzes user review history to personalize memory stability parameters via Rust WASI binding (`@open-spaced-repetition/binding`).
- **Performance**: In-process native execution delivers response latencies under 50ms compared to 800ms in external Python microservices.

### 2.2. Interactive Audio & Listening Engine
- **Automated Processing**: Direct extraction of video transcripts and timestamps via `youtubei.js`.
- **Intelligent Cloze Generator**: Algorithmic blank selection paired with LLM-assisted context definitions and comprehension quizzes.

### 2.3. Generative AI Tutor & Roleplay
- **Conversational Scenarios**: Realistic communicative tasks powered by local LLM integration (Ollama) with configurable temperature, profile management, and structured JSON output.
- **Evaluation Gate**: Post-conversation scoring assessing task completion, grammar accuracy, and vocabulary depth.

---

## 3. Architecture Evolution: Microservices to Modular Monolith

### Architectural Comparison
| Dimension | Legacy Microservices (8 Services) | Modern Modular Monolith (1 Process) |
|---|---|---|
| **Runtime Processes** | 8 distinct containers (Node.js & Python) | 1 unified Node.js process |
| **Communication** | Network HTTP hops across internal gateway | In-process dependency injection |
| **Memory Consumption** | ~1.8 GB RAM across all services | < 150 MB RAM total |
| **Data Consistency** | Eventual consistency, vulnerable to network failure | Full ACID multi-schema PostgreSQL transactions |
| **Build Pipeline** | 8 independent Docker builds and deploy scripts | Single unified Rspack bundle (< 100ms) |
| **Database Schema** | Split across isolated migrations | Unified Prisma Client spanning 6 schemas |

---

## 4. Key Engineering Practices

1. **Strict Type Safety**: Strict TypeScript compilation with zero `any` declarations and structured DTO validation pipes.
2. **Unified Error Envelopes**: Standardized `ApiException` with application-wide HTTP status codes, machine-readable error codes, and unique request trace IDs.
3. **Multi-Tier Caching**: Redis-backed key-value store with granular scope invalidation preventing cache stampedes.
4. **Zero-Downtime Data Preservation**: Multi-schema PostgreSQL preserved without destructive migrations or column modifications.
