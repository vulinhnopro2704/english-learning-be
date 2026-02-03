-- Rename columns (NO DATA LOSS)
ALTER TABLE "lessons"
  RENAME COLUMN "course_id" TO "courseId";

ALTER TABLE "words"
  RENAME COLUMN "lesson_id" TO "lessonId";
