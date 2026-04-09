-- Extend PracticeType for dictionary save learning events
ALTER TYPE "PracticeType" ADD VALUE IF NOT EXISTS 'DICTIONARY_SAVE';

-- Extend Word with richer dictionary fields (additive only)
ALTER TABLE "Word"
  ADD COLUMN IF NOT EXISTS "phoneticUs" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "phoneticUk" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "audioUs" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "audioUk" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "audioUsFileId" UUID,
  ADD COLUMN IF NOT EXISTS "audioUkFileId" UUID,
  ADD COLUMN IF NOT EXISTS "dictionaryMetadata" JSONB;

-- Normalize legacy phonetic/audio into US fallback fields
UPDATE "Word"
SET "phoneticUs" = "pronunciation"
WHERE "phoneticUs" IS NULL AND "pronunciation" IS NOT NULL;

UPDATE "Word"
SET "audioUs" = "audio"
WHERE "audioUs" IS NULL AND "audio" IS NOT NULL;

-- One word can have many examples
CREATE TABLE IF NOT EXISTS "WordExample" (
  "id" SERIAL NOT NULL,
  "wordId" INTEGER NOT NULL,
  "example" TEXT NOT NULL,
  "exampleVi" TEXT,
  "exampleAudio" VARCHAR(255),
  "order" INTEGER NOT NULL DEFAULT 0,
  "source" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "WordExample_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WordExample_wordId_fkey" FOREIGN KEY ("wordId")
    REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WordExample_wordId_example_key" UNIQUE ("wordId", "example")
);

CREATE INDEX IF NOT EXISTS "WordExample_wordId_idx" ON "WordExample"("wordId");
CREATE INDEX IF NOT EXISTS "WordExample_wordId_order_idx" ON "WordExample"("wordId", "order");

-- Backfill existing single example fields into WordExample (idempotent)
INSERT INTO "WordExample" ("wordId", "example", "exampleVi", "order", "createdAt", "updatedAt")
SELECT w."id", w."example", w."exampleVi", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Word" w
WHERE w."example" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "WordExample" we
    WHERE we."wordId" = w."id"
      AND we."example" = w."example"
  );
