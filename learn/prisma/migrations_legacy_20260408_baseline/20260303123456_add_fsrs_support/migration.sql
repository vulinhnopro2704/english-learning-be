-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

--------------------------------------------------
-- ALTER EXISTING TABLES
--------------------------------------------------

-- Course
ALTER TABLE "Course"
  RENAME CONSTRAINT "api_course_pkey" TO "Course_pkey";

ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Course"
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;


-- Lesson
ALTER TABLE "Lesson"
  RENAME CONSTRAINT "api_lesson_pkey" TO "Lesson_pkey";

ALTER TABLE "Lesson"
  ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Lesson"
  ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Lesson"
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;


-- Word
ALTER TABLE "Word"
  RENAME CONSTRAINT "api_word_pkey" TO "Word_pkey";

ALTER TABLE "Word"
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

--------------------------------------------------
-- CREATE TABLES
--------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'LessonStatus'
  ) THEN
    CREATE TYPE "LessonStatus" AS ENUM ('LOCKED', 'UNLOCKED', 'IN_PROGRESS', 'COMPLETED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'WordMasteryLevel'
  ) THEN
    CREATE TYPE "WordMasteryLevel" AS ENUM ('NEW', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "UserStreak" (
    "userId" UUID PRIMARY KEY,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActivity" TIMESTAMPTZ(6) NOT NULL
);

CREATE TABLE IF NOT EXISTS "UserCourseProgress" (
    "id" SERIAL PRIMARY KEY,
    "userId" UUID NOT NULL,
    "courseId" INTEGER NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMPTZ(6) NOT NULL
);

CREATE TABLE IF NOT EXISTS "UserLessonProgress" (
    "id" SERIAL PRIMARY KEY,
    "userId" UUID NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'LOCKED',
    "score" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMPTZ(6)
);

CREATE TABLE IF NOT EXISTS "UserWordProgress" (
    "id" SERIAL PRIMARY KEY,
    "userId" UUID NOT NULL,
    "wordId" INTEGER NOT NULL,
    "status" "WordMasteryLevel" NOT NULL DEFAULT 'NEW',
    "proficiency" INTEGER NOT NULL DEFAULT 0,
    "nextReview" TIMESTAMPTZ(6),
    "lastReviewedAt" TIMESTAMPTZ(6),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "state" INTEGER NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "UserVocabularyNote" (
    "id" SERIAL PRIMARY KEY,
    "userId" UUID NOT NULL,
    "wordId" INTEGER NOT NULL,
    "note" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "customExample" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL
);

CREATE TABLE IF NOT EXISTS "ReviewLog" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "wordId" INTEGER NOT NULL,
    "grade" INTEGER NOT NULL,
    "state" INTEGER NOT NULL,
    "elapsedDays" INTEGER NOT NULL,
    "scheduledDays" INTEGER NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMPTZ(6) NOT NULL
);

CREATE TABLE IF NOT EXISTS "UserFSRSSetting" (
    "id" SERIAL PRIMARY KEY,
    "userId" UUID NOT NULL,
    "weights" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "easyDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "maxReviewsPerDay" INTEGER NOT NULL DEFAULT 100,
    "requestRetention" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL
);

--------------------------------------------------
-- INDEXES
--------------------------------------------------

CREATE INDEX IF NOT EXISTS "UserCourseProgress_userId_idx"
  ON "UserCourseProgress"("userId");

ALTER TABLE "UserCourseProgress"
  ADD CONSTRAINT "UserCourseProgress_userId_courseId_key"
  UNIQUE ("userId", "courseId");

CREATE INDEX IF NOT EXISTS "UserLessonProgress_userId_idx"
  ON "UserLessonProgress"("userId");

ALTER TABLE "UserLessonProgress"
  ADD CONSTRAINT "UserLessonProgress_userId_lessonId_key"
  UNIQUE ("userId", "lessonId");

CREATE INDEX IF NOT EXISTS "UserWordProgress_userId_idx"
  ON "UserWordProgress"("userId");

CREATE INDEX IF NOT EXISTS "UserWordProgress_nextReview_idx"
  ON "UserWordProgress"("nextReview");

CREATE INDEX IF NOT EXISTS "UserWordProgress_userId_status_idx"
  ON "UserWordProgress"("userId", "status");

ALTER TABLE "UserWordProgress"
  ADD CONSTRAINT "UserWordProgress_userId_wordId_key"
  UNIQUE ("userId", "wordId");

CREATE INDEX IF NOT EXISTS "UserVocabularyNote_userId_idx"
  ON "UserVocabularyNote"("userId");

ALTER TABLE "UserVocabularyNote"
  ADD CONSTRAINT "UserVocabularyNote_userId_wordId_key"
  UNIQUE ("userId", "wordId");

CREATE INDEX IF NOT EXISTS "ReviewLog_userId_wordId_idx"
  ON "ReviewLog"("userId", "wordId");

CREATE INDEX IF NOT EXISTS "ReviewLog_reviewedAt_idx"
  ON "ReviewLog"("reviewedAt");

ALTER TABLE "UserFSRSSetting"
  ADD CONSTRAINT "UserFSRSSetting_userId_key"
  UNIQUE ("userId");

--------------------------------------------------
-- FOREIGN KEYS
--------------------------------------------------

ALTER TABLE "Lesson"
  ADD CONSTRAINT "Lesson_courseId_fkey"
  FOREIGN KEY ("courseId")
  REFERENCES "Course"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Word"
  ADD CONSTRAINT "Word_lessonId_fkey"
  FOREIGN KEY ("lessonId")
  REFERENCES "Lesson"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserCourseProgress"
  ADD CONSTRAINT "UserCourseProgress_courseId_fkey"
  FOREIGN KEY ("courseId")
  REFERENCES "Course"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserLessonProgress"
  ADD CONSTRAINT "UserLessonProgress_lessonId_fkey"
  FOREIGN KEY ("lessonId")
  REFERENCES "Lesson"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserWordProgress"
  ADD CONSTRAINT "UserWordProgress_wordId_fkey"
  FOREIGN KEY ("wordId")
  REFERENCES "Word"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserVocabularyNote"
  ADD CONSTRAINT "UserVocabularyNote_wordId_fkey"
  FOREIGN KEY ("wordId")
  REFERENCES "Word"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewLog"
  ADD CONSTRAINT "ReviewLog_wordId_fkey"
  FOREIGN KEY ("wordId")
  REFERENCES "Word"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewLog"
  ADD CONSTRAINT "ReviewLog_userId_wordId_fkey"
  FOREIGN KEY ("userId", "wordId")
  REFERENCES "UserWordProgress"("userId", "wordId")
  ON DELETE CASCADE ON UPDATE CASCADE;

--------------------------------------------------
-- RENAME INDEX
--------------------------------------------------

ALTER INDEX IF EXISTS "api_lesson_course_id_cc1d5c75"
  RENAME TO "Lesson_courseId_idx";

ALTER INDEX IF EXISTS "api_word_lesson_id_ee17c753"
  RENAME TO "Word_lessonId_idx";