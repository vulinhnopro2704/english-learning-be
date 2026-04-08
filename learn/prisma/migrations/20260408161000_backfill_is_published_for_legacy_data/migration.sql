-- Backfill legacy content to published after adding isPublished with default false.
-- Existing system content (not user-created) is expected to be published.
UPDATE "Course"
SET "isPublished" = true
WHERE "isPublished" = false
  AND COALESCE("isUserCreated", false) = false
  AND "createdByUserId" IS NULL;

UPDATE "Lesson"
SET "isPublished" = true
WHERE "isPublished" = false
  AND COALESCE("isUserCreated", false) = false
  AND "createdByUserId" IS NULL;
