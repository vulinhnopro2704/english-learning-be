-- Add ownership fields for user-created course and lesson content.
ALTER TABLE "Course"
ADD COLUMN "isUserCreated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "createdByUserId" UUID;

ALTER TABLE "Lesson"
ADD COLUMN "isUserCreated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "createdByUserId" UUID;

CREATE INDEX "Course_createdByUserId_idx" ON "Course"("createdByUserId");
CREATE INDEX "Course_isUserCreated_createdByUserId_idx" ON "Course"("isUserCreated", "createdByUserId");

CREATE INDEX "Lesson_createdByUserId_idx" ON "Lesson"("createdByUserId");
CREATE INDEX "Lesson_isUserCreated_createdByUserId_idx" ON "Lesson"("isUserCreated", "createdByUserId");
