ALTER TABLE "Word"
  ADD COLUMN "sourceProvider" VARCHAR(50) NOT NULL DEFAULT 'internal',
  ADD COLUMN "externalDictionaryId" INTEGER;

CREATE INDEX "Word_sourceProvider_externalDictionaryId_idx"
  ON "Word"("sourceProvider", "externalDictionaryId");
