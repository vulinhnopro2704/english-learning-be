-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('LOCKED', 'UNLOCKED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "WordMasteryLevel" AS ENUM ('NEW', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5');

-- CreateEnum
CREATE TYPE "PracticeType" AS ENUM ('FSRS', 'LEARN_LESSON');

-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "api_lesson_course_id_cc1d5c75_fk_api_course_id";

-- DropForeignKey
ALTER TABLE "Word" DROP CONSTRAINT "api_word_lesson_id_ee17c753_fk_api_lesson_id";

-- AlterTable
ALTER TABLE "Course" RENAME CONSTRAINT "api_course_pkey" TO "Course_pkey";
ALTER TABLE "Course" ADD COLUMN "createdByUserId" UUID;
ALTER TABLE "Course" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN "isUserCreated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Course" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Lesson" RENAME CONSTRAINT "api_lesson_pkey" TO "Lesson_pkey";
ALTER TABLE "Lesson" ADD COLUMN "createdByUserId" UUID;
ALTER TABLE "Lesson" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lesson" ADD COLUMN "isUserCreated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lesson" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lesson" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Word" RENAME CONSTRAINT "api_word_pkey" TO "Word_pkey";
ALTER TABLE "Word" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "UserStreak" (
    "userId" UUID NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActivity" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "UserStreak_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserCourseProgress" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "courseId" INTEGER NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "UserCourseProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLessonProgress" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'LOCKED',
    "score" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "UserLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWordProgress" (
    "id" SERIAL NOT NULL,
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
    "lapses" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserWordProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVocabularyNote" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "wordId" INTEGER NOT NULL,
    "note" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "customExample" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "UserVocabularyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeSession" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "type" "PracticeType" NOT NULL,
    "lessonId" INTEGER,
    "totalWords" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "totalDurationMs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "PracticeSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserCourseProgress_userId_idx" ON "UserCourseProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCourseProgress_userId_courseId_key" ON "UserCourseProgress"("userId", "courseId");

-- CreateIndex
CREATE INDEX "UserLessonProgress_userId_idx" ON "UserLessonProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserLessonProgress_userId_lessonId_key" ON "UserLessonProgress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "UserWordProgress_userId_idx" ON "UserWordProgress"("userId");

-- CreateIndex
CREATE INDEX "UserWordProgress_nextReview_idx" ON "UserWordProgress"("nextReview");

-- CreateIndex
CREATE INDEX "UserWordProgress_userId_status_idx" ON "UserWordProgress"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserWordProgress_userId_wordId_key" ON "UserWordProgress"("userId", "wordId");

-- CreateIndex
CREATE INDEX "UserVocabularyNote_userId_idx" ON "UserVocabularyNote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserVocabularyNote_userId_wordId_key" ON "UserVocabularyNote"("userId", "wordId");

-- CreateIndex
CREATE INDEX "PracticeSession_userId_idx" ON "PracticeSession"("userId");

-- CreateIndex
CREATE INDEX "PracticeSession_userId_type_idx" ON "PracticeSession"("userId", "type");

-- CreateIndex
CREATE INDEX "Course_createdByUserId_idx" ON "Course"("createdByUserId");

-- CreateIndex
CREATE INDEX "Course_isUserCreated_createdByUserId_idx" ON "Course"("isUserCreated", "createdByUserId");

-- CreateIndex
CREATE INDEX "Lesson_createdByUserId_idx" ON "Lesson"("createdByUserId");

-- CreateIndex
CREATE INDEX "Lesson_isUserCreated_createdByUserId_idx" ON "Lesson"("isUserCreated", "createdByUserId");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Word" ADD CONSTRAINT "Word_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCourseProgress" ADD CONSTRAINT "UserCourseProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLessonProgress" ADD CONSTRAINT "UserLessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWordProgress" ADD CONSTRAINT "UserWordProgress_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVocabularyNote" ADD CONSTRAINT "UserVocabularyNote_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "api_lesson_course_id_cc1d5c75" RENAME TO "Lesson_courseId_idx";

-- RenameIndex
ALTER INDEX "api_word_lesson_id_ee17c753" RENAME TO "Word_lessonId_idx";

