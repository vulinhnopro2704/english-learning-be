-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "courses" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "en_title" VARCHAR(255),
    "description" TEXT,
    "image" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "icon" VARCHAR(10),

    CONSTRAINT "api_course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "image" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "course_id" INTEGER,

    CONSTRAINT "api_lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "words" (
    "id" SERIAL NOT NULL,
    "word" VARCHAR(255) NOT NULL,
    "pronunciation" VARCHAR(255),
    "meaning" TEXT NOT NULL,
    "example" TEXT,
    "example_vi" TEXT,
    "image" VARCHAR(255),
    "audio" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "lesson_id" INTEGER,
    "pos" VARCHAR(255),
    "cefr" VARCHAR(10),

    CONSTRAINT "api_word_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_lesson_course_id_cc1d5c75" ON "lessons"("course_id");

-- CreateIndex
CREATE INDEX "api_word_lesson_id_ee17c753" ON "words"("lesson_id");

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "api_lesson_course_id_cc1d5c75_fk_api_course_id" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "words" ADD CONSTRAINT "api_word_lesson_id_ee17c753_fk_api_lesson_id" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

