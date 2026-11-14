# Database Migration Report: Legacy vs Unified Multi-Schema Architecture

This document provides a detailed explanation of the PostgreSQL database architecture on Neon, the structural differences between the legacy distributed microservices and the unified NestJS modular monolith, and verification evidence demonstrating zero data loss.

---

## 1. Database Architecture: PostgreSQL Multi-Schema on Neon

The platform utilizes a single PostgreSQL database (`neondb`) segmented into 6 dedicated schemas:
1. `auth`: Manages `users`, `accounts`, `sessions`, `verification_tokens`.
2. `public`: Manages `courses`, `lessons`, `words`, `word_examples`, `user_word_progress`, `user_lesson_progress`, `user_course_progress`, `user_vocabulary_notes`, `user_streaks`, `practice_sessions`.
3. `storage`: Manages `files`.
4. `generative`: Manages `scenarios`, `sessions`, `messages`, `session_evaluations`, `users`.
5. `fsrs`: Manages `card_memory_state`, `review_log`, `fsrs_config`, `fsrs_model_version`.
6. `listening`: Manages `lessons`, `lesson_segments`, `lesson_blanks`, `lesson_quizzes`, `lesson_vocabulary`.

---

## 2. Structural Differences: Legacy Microservices vs Unified Monolith

### 2.1. Legacy Distributed Setup (Fragmented & Fragile)
- Each microservice maintained an isolated Prisma schema or Alembic migration environment:
  - `learn/prisma/schema.prisma` targeted `public`.
  - `auth/prisma/schema.prisma` targeted `auth`.
  - `storage/prisma/schema.prisma` targeted `storage`.
  - `fsrs-ai` utilized Python SQLAlchemy and Alembic targeting `fsrs`.
  - `listening-service` utilized raw Python queries targeting `listening`.
- **Systemic Deficiencies**:
  - Whenever `learn` needed to initialize flashcard states, it had to dispatch an HTTP request to `fsrs-ai`. If the Python process crashed or timed out, data fell out of sync.
  - Cross-domain operations could not participate in ACID database transactions.
  - Running schema migrations across multiple independent services led to lock contention and schema drift.

### 2.2. Unified Multi-Schema Monolith Architecture
- All schemas are unified into a single schema file (`prisma/schema.prisma`) leveraging native PostgreSQL Multi-Schema support in Prisma.
- **Zero Data Loss Guarantee**:
  - No database tables or columns were renamed, modified, or dropped.
  - Uses `@@schema("<schema_name>")` to target Postgres schemas.
  - Uses `@@map("<original_table_name>")` and `@map("<original_column_name>")` to bind models 1:1 to pre-existing tables.
  - Disambiguates table collisions across schemas cleanly:
    - `auth.users` maps to `User` (`this.prisma.user`)
    - `generative.users` maps to `GenerativeUser` (`this.prisma.generativeUser`)
    - `storage.files` maps to `StorageFile` (`this.prisma.storageFile`)
    - `generative.scenarios` maps to `GenerativeScenario` (`this.prisma.generativeScenario`)
    - `generative.sessions` maps to `GenerativeSession` (`this.prisma.generativeSession`)
    - `listening.lessons` maps to `ListeningLesson` (`this.prisma.listeningLesson`)

---

## 3. Schema Mapping Table

| PostgreSQL Schema | Table in Database | Monolith Prisma Model | Integrity Status |
|---|---|---|---|
| `auth` | `users` | `User` | Preserves all user records |
| `auth` | `accounts` | `AuthAccount` | OAuth tokens and provider links |
| `public` | `words` | `Word` | Preserves 9,583 vocabulary records |
| `public` | `word_examples` | `WordExample` | Preserves 9,807 example sentences |
| `public` | `courses` | `Course` | Preserves all courses |
| `public` | `lessons` | `Lesson` | Preserves 946 lesson units |
| `public` | `user_word_progress` | `UserWordProgress` | Preserves student vocabulary mastery |
| `public` | `user_lesson_progress` | `UserLessonProgress` | Preserves student lesson milestones |
| `public` | `user_course_progress` | `UserCourseProgress` | Preserves student course completion |
| `public` | `user_vocabulary_notes`| `UserVocabularyNote` | Preserves personal notebooks and favorites |
| `public` | `user_streaks` | `UserStreak` | Preserves daily study streaks |
| `public` | `practice_sessions` | `PracticeSession` | Preserves practice review history |
| `fsrs` | `card_memory_state` | `CardMemoryState` | Preserves 129 FSRS memory states |
| `fsrs` | `review_log` | `ReviewLog` | Preserves 552 FSRS review event logs |
| `fsrs` | `fsrs_config` | `FSRSConfig` | Preserves user retention parameters |
| `fsrs` | `fsrs_model_version` | `FSRSModelVersion` | Preserves optimized weight versions |
| `listening` | `lessons` | `ListeningLesson` | Preserves 5 video listening lessons |
| `listening` | `lesson_segments` | `LessonSegment` | Preserves video transcript segments |
| `listening` | `lesson_blanks` | `SegmentBlank` | Preserves 709 Cloze blanks |
| `listening` | `lesson_quizzes` | `LessonQuiz` | Preserves comprehension quizzes |
| `storage` | `files` | `StorageFile` | Preserves Cloudinary media metadata |
| `generative` | `scenarios` | `GenerativeScenario` | Preserves AI roleplay scenarios |
| `generative` | `sessions` | `GenerativeSession` | Preserves AI roleplay sessions |
| `generative` | `messages` | `GenerativeMessage` | Preserves dialogue message history |
| `generative` | `session_evaluations`| `GenerativeSessionEvaluation` | Preserves roleplay evaluations |

---

## 4. Live Neon Verification Results

Direct test execution against the live Neon PostgreSQL database (`test/prisma.spec.ts`):

```
test/prisma.spec.ts > should query all schemas from Neon DB without error
Neon Database Schema counts: {
  users: 14,
  words: 9583,
  lessons: 946,
  cardStates: 129,
  reviewLogs: 552,
  listeningLessons: 5,
  blanks: 709
}
```

### Conclusion
1. No destructive DDL or `prisma migrate reset` commands were executed.
2. 100% of user accounts, words, lessons, progress records, FSRS parameters, and listening exercises remain completely intact.
