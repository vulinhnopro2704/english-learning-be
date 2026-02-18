/* =========================
   Course
========================= */
ALTER TABLE "Course"
  RENAME COLUMN "created_at" TO "createdAt";

ALTER TABLE "Course"
  RENAME COLUMN "updated_at" TO "updatedAt";

ALTER TABLE "Course"
  RENAME COLUMN "en_title" TO "enTitle";

/* =========================
   Lesson
========================= */
ALTER TABLE "Lesson"
  RENAME COLUMN "created_at" TO "createdAt";

ALTER TABLE "Lesson"
  RENAME COLUMN "updated_at" TO "updatedAt";

/* =========================
   Word
========================= */
ALTER TABLE "Word"
  RENAME COLUMN "created_at" TO "createdAt";

ALTER TABLE "Word"
  RENAME COLUMN "updated_at" TO "updatedAt";

ALTER TABLE "Word"
  RENAME COLUMN "example_vi" TO "exampleVi";
