-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "storage";

-- CreateEnum
CREATE TYPE "storage"."FileType" AS ENUM ('IMAGE', 'VIDEO', 'FILE');

-- CreateTable
CREATE TABLE "storage"."files" (
    "id" UUID NOT NULL,
    "public_id" VARCHAR(255) NOT NULL,
    "secure_url" TEXT NOT NULL,
    "type" "storage"."FileType" NOT NULL,
    "format" VARCHAR(20),
    "size" INTEGER NOT NULL,
    "owner_id" UUID NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_public_id_key" ON "storage"."files"("public_id");

-- CreateIndex
CREATE INDEX "idx_files_owner_created" ON "storage"."files"("owner_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_files_type_created" ON "storage"."files"("type", "created_at" DESC);

